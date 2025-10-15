import os
import sys
import json
import argparse
from datetime import datetime
from pathlib import Path

import torch
import torch.nn as nn
import torch.optim as optim
from torchvision import datasets, transforms, models
from torch.utils.data import DataLoader, random_split
from torch.optim.lr_scheduler import ReduceLROnPlateau
import matplotlib.pyplot as plt


def print_progress(message):
    """Print progress message that will be captured by Node.js"""
    print(message, flush=True)
    sys.stdout.flush()


#---------------- Config ----------------
class Config:
    def __init__(self, args):
        self.DATA_DIR = args.data_dir
        self.MODEL_DIR = args.output_dir
        self.MODEL_NAME = args.model_name
        self.BATCH_SIZE = args.batch_size
        self.IMG_SIZE = (224, 224)
        self.VAL_SPLIT = 0.2  # 20% testing set
        self.TOTAL_EPOCHS = args.epochs
        self.STAGE1_EPOCHS = min(10, args.epochs // 3)  #First 1/3 or max 10
        self.LR_STAGE1 = args.learning_rate
        self.LR_FINETUNE = args.learning_rate / 2
        self.FINE_TUNE_AT = 15
        self.PATIENCE = 5
        self.DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")


#---------------- Utilities ----------------
def create_model_folder(base_dir: str, model_name: str) -> str:
    """Create a new model folder."""
    base_folder_path = os.path.join(base_dir, model_name)
    folder_path = base_folder_path
    counter = 1

    while os.path.exists(folder_path):
        folder_path = f"{base_folder_path}.{counter}"
        counter += 1
    os.makedirs(folder_path, exist_ok=True)
    if folder_path != base_folder_path:
        actual_model_name = os.path.basename(folder_path)
        print_progress(f"Model folder '{model_name}' already exists. Using '{actual_model_name}' instead.")
    return folder_path

def save_label_map(class_names, folder: str):
    """Save class names to JSON file"""
    with open(os.path.join(folder, "label_map.json"), "w") as f:
        json.dump(class_names, f, indent=2)
    print_progress(f"Saved label map with {len(class_names)} classes")


def plot_metrics(history: dict, save_path: str):
    """Plot and save training metrics"""
    epochs = range(1, len(history["train_acc"]) + 1)
    plt.figure(figsize=(12, 5))

    plt.subplot(1, 2, 1)
    plt.plot(epochs, history["train_acc"], label="train_accuracy")
    plt.plot(epochs, history["val_acc"], label="val_accuracy")
    plt.title("Accuracy")
    plt.xlabel("Epoch")
    plt.ylabel("Accuracy")
    plt.legend()

    plt.subplot(1, 2, 2)
    plt.plot(epochs, history["train_loss"], label="train_loss")
    plt.plot(epochs, history["val_loss"], label="val_loss")
    plt.title("Loss")
    plt.xlabel("Epoch")
    plt.ylabel("Loss")
    plt.legend()

    plt.tight_layout()
    plt.savefig(save_path)
    plt.close()
    print_progress(f"Saved training plots to {save_path}")


#---------------- Data ----------------
def prepare_data(config: Config):
    """Prepare training and validation data loaders"""
    print_progress("Loading dataset...")
    
    # Class names
    class_names = sorted([p.name for p in Path(config.DATA_DIR).iterdir() if p.is_dir()])
    num_classes = len(class_names)
    print_progress(f"Detected {num_classes} classes: {', '.join(class_names)}")

    # Transforms
    train_transform = transforms.Compose([
        transforms.RandomHorizontalFlip(),
        transforms.RandomRotation(12),
        transforms.RandomResizedCrop(config.IMG_SIZE[0], scale=(0.9, 1.0)),
        transforms.ColorJitter(contrast=0.12, brightness=0.1),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406],
                             [0.229, 0.224, 0.225])
    ])
    val_transform = transforms.Compose([
        transforms.Resize(config.IMG_SIZE),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406],
                             [0.229, 0.224, 0.225])
    ])

    # Dataset and split
    dataset = datasets.ImageFolder(config.DATA_DIR, transform=train_transform)
    val_size = int(len(dataset) * config.VAL_SPLIT)
    train_size = len(dataset) - val_size
    
    print_progress(f"Total images: {len(dataset)}")
    print_progress(f"Training samples: {train_size}")
    print_progress(f"Validation samples: {val_size}")
    
    train_dataset, val_dataset = random_split(dataset, [train_size, val_size])
    val_dataset.dataset.transform = val_transform

    # Dataloaders
    train_loader = DataLoader(
        train_dataset, 
        batch_size=config.BATCH_SIZE, 
        shuffle=True,
        num_workers=0  # Changed to 0 for Windows compatibility
    )
    val_loader = DataLoader(
        val_dataset, 
        batch_size=config.BATCH_SIZE, 
        shuffle=False,
        num_workers=0  # Changed to 0 for Windows compatibility
    )

    return train_loader, val_loader, class_names


#---------------- Model ----------------
def build_model(num_classes: int, device):
    """Build MobileNetV2 model with custom classifier"""
    print_progress("Building MobileNetV2 model...")
    
    model = models.mobilenet_v2(weights=models.MobileNet_V2_Weights.IMAGENET1K_V1)
    
    # Freeze feature extractor initially
    for param in model.features.parameters():
        param.requires_grad = False

    # Custom classifier
    model.classifier = nn.Sequential(
        nn.Dropout(p=0.3),
        nn.Linear(model.last_channel, 256),
        nn.ReLU(),
        nn.Linear(256, num_classes)
    )

    print_progress(f"Model built with {num_classes} output classes")
    return model.to(device)


#---------------- Training ----------------
def train_one_epoch(model, loader, optimizer, criterion, device, epoch, total_epochs, stage):
    """Train for one epoch"""
    model.train()
    total_loss, correct, total = 0, 0, 0
    
    for batch_idx, (x, y) in enumerate(loader):
        x, y = x.to(device), y.to(device)
        optimizer.zero_grad()
        out = model(x)
        loss = criterion(out, y)
        loss.backward()
        optimizer.step()
        
        total_loss += loss.item() * x.size(0)
        _, pred = out.max(1)
        correct += pred.eq(y).sum().item()
        total += y.size(0)
        
        # Print progress every 5 batches
        if (batch_idx + 1) % 5 == 0 or (batch_idx + 1) == len(loader):
            batch_loss = total_loss / total
            batch_acc = correct / total
            print_progress(
                f"Epoch {epoch}/{total_epochs} - "
                f"Batch {batch_idx + 1}/{len(loader)} - "
                f"Loss: {batch_loss:.4f} - "
                f"Accuracy: {batch_acc*100:.2f}%"
            )
    
    return total_loss / total, correct / total


def validate(model, loader, criterion, device):
    """Validate the model"""
    model.eval()
    total_loss, correct, total = 0, 0, 0
    
    with torch.no_grad():
        for x, y in loader:
            x, y = x.to(device), y.to(device)
            out = model(x)
            loss = criterion(out, y)
            total_loss += loss.item() * x.size(0)
            _, pred = out.max(1)
            correct += pred.eq(y).sum().item()
            total += y.size(0)
    
    return total_loss / total, correct / total


def train_model(model, train_loader, val_loader, config: Config, save_folder: str):
    """Main training loop with two stages"""
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=config.LR_STAGE1)
    scheduler = ReduceLROnPlateau(optimizer, mode='min', factor=0.5, patience=3)

    history = {"train_loss": [], "train_acc": [], "val_loss": [], "val_acc": []}
    best_val_acc = 0.0
    best_loss = float("inf")
    no_improve_count = 0

    print_progress("=" * 60)
    print_progress("Stage 1: Training classifier head")
    print_progress("=" * 60)

    completed_stage1 = True

    #---------------- Stage 1: Train Head ----------------
    for epoch in range(1, config.STAGE1_EPOCHS + 1):
        tr_loss, tr_acc = train_one_epoch(
            model, train_loader, optimizer, criterion, 
            config.DEVICE, epoch, config.STAGE1_EPOCHS, "Stage1"
        )
        val_loss, val_acc = validate(model, val_loader, criterion, config.DEVICE)
        scheduler.step(val_loss)

        history["train_loss"].append(tr_loss)
        history["train_acc"].append(tr_acc)
        history["val_loss"].append(val_loss)
        history["val_acc"].append(val_acc)

        print_progress(f"\nEpoch {epoch}/{config.STAGE1_EPOCHS} Summary:")
        print_progress(f"Train Loss: {tr_loss:.4f} - Train Accuracy: {tr_acc*100:.2f}%")
        print_progress(f"Val Loss: {val_loss:.4f} - Val Accuracy: {val_acc*100:.2f}%")

        # Track best model
        if val_acc > best_val_acc:
            best_val_acc = val_acc

        # Early stopping based on loss
        if val_loss < best_loss:
            best_loss = val_loss
            no_improve_count = 0
        else:
            no_improve_count += 1
            if no_improve_count >= config.PATIENCE:
                torch.save(model.state_dict(), os.path.join(save_folder, "best_model.pth"))
                print_progress("Early stopping during Stage 1")
                completed_stage1 = False
                break

    #---------------- Stage 2: Fine-Tune ----------------
    if completed_stage1 and config.STAGE1_EPOCHS < config.TOTAL_EPOCHS:
        print_progress("\n" + "=" * 60)
        print_progress("Stage 2: Fine-tuning entire network")
        print_progress("=" * 60)
        
        # Unfreeze layers for fine-tuning
        for i, layer in enumerate(model.features):
            for param in layer.parameters():
                param.requires_grad = (i >= config.FINE_TUNE_AT)

        optimizer = optim.Adam(
            filter(lambda p: p.requires_grad, model.parameters()), 
            lr=config.LR_FINETUNE
        )
        scheduler = ReduceLROnPlateau(optimizer, 'min', factor=0.5, patience=3)
        
        # Reset early stopping counter for stage 2
        no_improve_count = 0

        for epoch in range(config.STAGE1_EPOCHS + 1, config.TOTAL_EPOCHS + 1):
            tr_loss, tr_acc = train_one_epoch(
                model, train_loader, optimizer, criterion, 
                config.DEVICE, epoch, config.TOTAL_EPOCHS, "FineTune"
            )
            val_loss, val_acc = validate(model, val_loader, criterion, config.DEVICE)
            scheduler.step(val_loss)

            history["train_loss"].append(tr_loss)
            history["train_acc"].append(tr_acc)
            history["val_loss"].append(val_loss)
            history["val_acc"].append(val_acc)

            print_progress(f"\nEpoch {epoch}/{config.TOTAL_EPOCHS} Summary:")
            print_progress(f"Train Loss: {tr_loss:.4f} - Train Accuracy: {tr_acc*100:.2f}%")
            print_progress(f"Val Loss: {val_loss:.4f} - Val Accuracy: {val_acc*100:.2f}%")

            # Track best model
            if val_acc > best_val_acc:
                best_val_acc = val_acc

            # Early stopping
            if val_loss < best_loss:
                best_loss = val_loss
                no_improve_count = 0
            else:
                no_improve_count += 1
                if no_improve_count >= config.PATIENCE:
                    torch.save(model.state_dict(), os.path.join(save_folder, "best_model.pth"))
                    print_progress("Early stopping during Fine-Tune Stage")
                    break

    # Save final model
    torch.save(model.state_dict(), os.path.join(save_folder, "mobilenetv2_final.pth"))
    print_progress(f"Final model saved")
    
    return history, best_val_acc


# ---------------- Main ----------------
def main():
    SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

    parser = argparse.ArgumentParser(description='Train plant disease classification model')
    parser.add_argument('--data-dir', type=str, default=os.path.join(SCRIPT_DIR, 'New_Dataset'), 
                        help='Path to dataset directory')
    parser.add_argument('--epochs', type=int, default=30, 
                        help='Number of training epochs')
    parser.add_argument('--batch-size', type=int, default=32, 
                        help='Batch size for training')
    parser.add_argument('--learning-rate', type=float, default=1e-5, 
                        help='Initial learning rate')
    parser.add_argument('--model-name', type=str, default=None, 
                        help='Model name (auto-generated if not provided)')
    parser.add_argument('--output-dir', type=str, default='./models', 
                        help='Directory to save trained models')
    args = parser.parse_args()

    # Generate model name if not provided
    if args.model_name is None:
        args.model_name = f"model_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

    print_progress("=" * 60)
    print_progress("Plant Classification Training")
    print_progress("=" * 60)
    print_progress(f"Model Name: {args.model_name}")
    print_progress(f"Epochs: {args.epochs}")
    print_progress(f"Batch Size: {args.batch_size}")
    print_progress(f"Learning Rate: {args.learning_rate}")
    print_progress(f"Data Directory: {args.data_dir}")
    print_progress(f"Output Directory: {args.output_dir}")
    print_progress("=" * 60)

    # Create config - FIXED: Pass args to Config
    config = Config(args)
    print_progress(f"Using device: {config.DEVICE}")

    # Create output directory
    os.makedirs(config.MODEL_DIR, exist_ok=True)
    save_folder = create_model_folder(config.MODEL_DIR, config.MODEL_NAME)

    # Prepare data
    try:
        train_loader, val_loader, class_names = prepare_data(config)
    except Exception as e:
        print_progress(f"ERROR: Failed to load dataset - {str(e)}")
        sys.exit(1)

    # Save label map
    save_label_map(class_names, save_folder)

    # Build model
    try:
        model = build_model(len(class_names), config.DEVICE)
    except Exception as e:
        print_progress(f"ERROR: Failed to build model - {str(e)}")
        sys.exit(1)

    # Train model
    try:
        history, best_val_acc = train_model(
            model, train_loader, val_loader, config, save_folder
        )

        # Plot metrics
        plot_path = os.path.join(save_folder, "training_plot.png")
        plot_metrics(history, plot_path)
        
        print_progress("=" * 60)
        print_progress("Training Complete!")
        print_progress(f"Best Validation Accuracy: {best_val_acc*100:.2f}%")
        print_progress(f"Model saved to: {save_folder}")
        print_progress("=" * 60)
    
    except Exception as e:
        print_progress(f"ERROR: Training failed - {str(e)}")
        import traceback
        print_progress(traceback.format_exc())
        sys.exit(1)


if __name__ == "__main__":
    main()