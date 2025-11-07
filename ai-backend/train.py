import os
import sys
import json
import argparse
from datetime import datetime

import torch
import torch.nn as nn
import torch.optim as optim
from torchvision import datasets, transforms, models
from torch.utils.data import DataLoader, random_split, Subset
from torch.optim.lr_scheduler import ReduceLROnPlateau
import matplotlib.pyplot as plt

import mysql.connector
from mysql.connector import Error

#debug
if sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")

def print_progress(message):
    """Print progress message that will be captured by Node.js"""
    print(message, flush=True)
    sys.stdout.flush()

#database connection function
def get_db_connection(config):
    """Create database connection"""
    try:
        connection = mysql.connector.connect(
            host=config.db_host,
            user=config.db_user,
            password=config.db_password,
            database=config.db_name
        )
        return connection
    except Error as e:
        print_progress(f"Database connection error: {e}")
        return None
    
def insert_training_record(connection, triggered_by, model_version, num_images, num_species):
    """Insert initial training record and return training_id"""
    cursor = connection.cursor()
    cursor.execute("""
        INSERT INTO training_history 
        (triggered_by, status, model_version, num_images, num_species, started_at)
        VALUES (%s, 'in_progress', %s, %s, %s, NOW())
    """, (triggered_by, model_version, num_images, num_species))
    connection.commit()
    training_id = cursor.lastrowid
    cursor.close()
    return training_id

def update_training_record(connection, training_id, status, training_acc=None, val_acc=None, error_msg=None):
    """Update training record on completion or error"""
    try:   
        if not connection.is_connected():
            connection.reconnect(attempts=3, delay=2) 

        cursor = connection.cursor()
        if status == 'completed':
            cursor.execute("""
                UPDATE training_history 
                SET status = %s, 
                    training_accuracy = %s, 
                    validation_accuracy = %s,
                    completed_at = NOW()
                WHERE id = %s
            """, (status, training_acc, val_acc, training_id))
        else:  # failed
            cursor.execute("""
                UPDATE training_history  
                SET status = %s, 
                    error_message = %s,
                    completed_at = NOW()
                WHERE id = %s
            """, (status, error_msg, training_id))
        connection.commit()
        cursor.close()   
    except Error as e:
        print_progress(f"Failed to update training record: {e}")


#---------------- Config ----------------
class Config:
    def __init__(self, args):
        self.DATA_DIR = args.data_dir
        self.MODEL_DIR = args.output_dir
        self.MODEL_NAME = args.model_name
        self.BATCH_SIZE = args.batch_size
        self.IMG_SIZE = (224, 224)
        self.VAL_SPLIT = 0.2  # 20% testing set
        self.MIN_IMAGES_PER_CLASS = args.min_images_per_class
        self.TOTAL_EPOCHS = args.epochs
        self.STAGE1_EPOCHS = min(10, args.epochs // 3)  #First 1/3 or max 10
        self.LR_STAGE1 = args.learning_rate
        self.LR_FINETUNE = args.learning_rate / 2
        self.FINE_TUNE_AT = 15
        self.PATIENCE = 5
        self.DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        #Database config
        self.db_host = "srv1758.hstgr.io"
        self.db_user = "u149795069_user"
        self.db_password = "Smartestplant123"
        self.db_name = "u149795069_smartplant"
        self.triggered_by = args.triggered_by

#---------------- Utilities ----------------
def create_model_folder(base_dir: str, model_name: str) -> str:
    """Create a new model folder."""
    base_folder_path = os.path.join(base_dir, model_name)
    folder_path = base_folder_path
    counter = 1

    while os.path.exists(folder_path):
        folder_path = f"{base_folder_path}{counter}"
        counter += 1
    os.makedirs(folder_path, exist_ok=True)
    actual_model_name = os.path.basename(folder_path)

    if folder_path != base_folder_path:
        print_progress(f"Model folder '{model_name}' already exists. Using '{actual_model_name}' instead.")
    
    return folder_path, actual_model_name

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


#---------------- Filter classes by minimum image count ----------------
def filter_dataset_by_class_size(dataset, min_images: int):
    """
    Filter dataset to only include classes with at least min_images samples.
    Returns filtered indices, valid class names, and class mapping.
    """
    # Count samples per class
    class_counts = {}
    class_to_indices = {}
    
    for idx, (_, class_idx) in enumerate(dataset.samples):
        if class_idx not in class_counts:
            class_counts[class_idx] = 0
            class_to_indices[class_idx] = []
        class_counts[class_idx] += 1
        class_to_indices[class_idx].append(idx)
    
    # Filter valid classes
    valid_class_indices = [cls_idx for cls_idx, count in class_counts.items() 
                          if count >= min_images]
    valid_class_indices.sort()
    
    # Get original class names
    original_classes = dataset.classes
    
    # Track skipped classes
    skipped_classes = []
    valid_classes = []
    
    for cls_idx in range(len(original_classes)):
        if cls_idx in valid_class_indices:
            valid_classes.append(original_classes[cls_idx])
        else:
            skipped_classes.append(f"{original_classes[cls_idx]} ({class_counts.get(cls_idx, 0)} images)")
    
    if skipped_classes:
        print_progress(f"\nWARNING: Skipping {len(skipped_classes)} class(es) with fewer than {min_images} images:")
        for skipped in skipped_classes:
            print_progress(f"  - {skipped}")
        print_progress("")
    
    # Create mapping from old class indices to new ones
    old_to_new_class = {old_idx: new_idx for new_idx, old_idx in enumerate(valid_class_indices)}
    
    # Collect valid sample indices
    valid_indices = []
    for cls_idx in valid_class_indices:
        valid_indices.extend(class_to_indices[cls_idx])
    
    return valid_indices, valid_classes, old_to_new_class


#---------------- Data ----------------
def prepare_data(config: Config):
    """Prepare training and validation data loaders with class filtering"""
    print_progress("Loading dataset...")
    
    # Load full dataset first
    full_dataset = datasets.ImageFolder(config.DATA_DIR)
    
    # Filter by minimum class size
    valid_indices, class_names, old_to_new_class = filter_dataset_by_class_size(
        full_dataset, config.MIN_IMAGES_PER_CLASS
    )
    
    num_classes = len(class_names)
    
    if num_classes == 0:
        raise ValueError(f"No classes have at least {config.MIN_IMAGES_PER_CLASS} images. Cannot train model.")
    
    print_progress(f"Using {num_classes} classes with sufficient data: {', '.join(class_names)}")
    
    # Create subset with only valid samples
    filtered_dataset = Subset(full_dataset, valid_indices)
    
    # Update class indices in the dataset
    original_samples = [full_dataset.samples[i] for i in valid_indices]
    remapped_samples = [(path, old_to_new_class[cls_idx]) for path, cls_idx in original_samples]
    
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
    
    # Create new ImageFolder with filtered data
    class RemappedDataset(torch.utils.data.Dataset):
        def __init__(self, samples, transform, loader):
            self.samples = samples
            self.transform = transform
            self.loader = loader
        
        def __len__(self):
            return len(self.samples)
        
        def __getitem__(self, idx):
            path, target = self.samples[idx]
            sample = self.loader(path)
            if self.transform is not None:
                sample = self.transform(sample)
            return sample, target
    
    # Create datasets with transforms
    full_remapped_dataset = RemappedDataset(
        remapped_samples, 
        train_transform,
        full_dataset.loader
    )
    
    # Split into train and validation
    val_size = int(len(full_remapped_dataset) * config.VAL_SPLIT)
    train_size = len(full_remapped_dataset) - val_size
    
    print_progress(f"Total valid images: {len(full_remapped_dataset)}")
    print_progress(f"Training samples: {train_size}")
    print_progress(f"Validation samples: {val_size}")
    
    train_dataset, val_dataset = random_split(full_remapped_dataset, [train_size, val_size])
    
    # Apply validation transform to val_dataset
    val_dataset_wrapped = RemappedDataset(
        [remapped_samples[i] for i in val_dataset.indices],
        val_transform,
        full_dataset.loader
    )
    
    # Dataloaders
    train_loader = DataLoader(
        train_dataset, 
        batch_size=config.BATCH_SIZE, 
        shuffle=True,
        num_workers=0  # Windows compatibility
    )
    val_loader = DataLoader(
        val_dataset_wrapped, 
        batch_size=config.BATCH_SIZE, 
        shuffle=False,
        num_workers=0  # Windows compatibility
    )

    return train_loader, val_loader, class_names


#---------------- Model ----------------
def build_model(num_classes: int, device):
    """Build ResNet-50 model with custom classifier"""
    print_progress("Building ResNet-50 model...")
    
    model = models.resnet50(weights=models.ResNet50_Weights.IMAGENET1K_V1)
    
     # Freeze all layers except fc
    for name, param in model.named_parameters():
        if "fc" not in name:
            param.requires_grad = False

    # Custom classifier
    in_features = model.fc.in_features
    model.fc = nn.Sequential(
        nn.Linear(in_features, 512),
        nn.ReLU(),
        nn.Dropout(p=0.3),
        nn.Linear(512, num_classes)
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
        for name, param in model.named_parameters():
            if "layer4" in name or "fc" in name:  # Only fine-tune deeper layers
                param.requires_grad = True
            else:
                param.requires_grad = False

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
    torch.save(model.state_dict(), os.path.join(save_folder, "best_model.pth"))
    print_progress(f"Final model saved")
    
    return history, best_val_acc


# ---------------- Main ----------------
def main():
    SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

    parser = argparse.ArgumentParser(description='Train plant classification model')
    parser.add_argument('--data-dir', type=str, default=os.path.join(SCRIPT_DIR, 'New_Dataset'), 
                        help='Path to dataset directory')
    parser.add_argument('--epochs', type=int, default=30, 
                        help='Number of training epochs')
    parser.add_argument('--batch-size', type=int, default=32, 
                        help='Batch size for training')
    parser.add_argument('--learning-rate', type=float, default=1e-5, 
                        help='Initial learning rate')
    parser.add_argument('--min-images-per-class', type=int, default=5, 
                        help='Minimum number of images required per class (default: 5)')
    parser.add_argument('--model-name', type=str, default=None, 
                        help='Model name (auto-generated if not provided)')
    parser.add_argument('--output-dir', type=str, default='./models', 
                        help='Directory to save trained models')
    parser.add_argument('--triggered-by', type=str, default=None, 
                    help='Who triggered training: auto, or user_id')
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
    print_progress(f"Min Images Per Class: {args.min_images_per_class}")
    print_progress(f"Data Directory: {args.data_dir}")
    print_progress(f"Output Directory: {args.output_dir}")
    print_progress(f"Troggered by user ID: {args.triggered_by}")
    
    print_progress("=" * 60)

    # Create config
    config = Config(args)
    print_progress(f"Using device: {config.DEVICE}")

    # Create output directory
    os.makedirs(config.MODEL_DIR, exist_ok=True)
    save_folder, actual_model_name = create_model_folder(config.MODEL_DIR, config.MODEL_NAME)
    
    json_output = json.dumps({
    "event": "model_folder_created",
    "model_name": actual_model_name
})
    sys.stdout.write(json_output + "\n")
    sys.stdout.flush()

    print_progress(f"=========  {actual_model_name} ========")

    # Prepare data
    try:
        train_loader, val_loader, class_names = prepare_data(config)
    except Exception as e:
        print_progress(f"ERROR: Failed to load dataset - {str(e)}")
        sys.exit(1)

    # Connect to database and create training record
    db_connection = get_db_connection(config)
    training_id = None
    if db_connection:
        total_images = len(train_loader.dataset) + len(val_loader.dataset)
        training_id = insert_training_record(
            db_connection, 
            config.triggered_by,
            actual_model_name,
            total_images,
            len(class_names)
        )
        print_progress(f"Training record created with ID: {training_id}")

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
        
        # Update database on success
        if db_connection and training_id:
            if not db_connection.is_connected():
                db_connection.reconnect()
            final_train_acc = history["train_acc"][-1]
            update_training_record(
                db_connection, 
                training_id, 
                'completed',
                final_train_acc,
                best_val_acc
            )
            db_connection.close()

        print_progress("=" * 60)
        print_progress("Training Complete!")
        print_progress(f"Best Validation Accuracy: {best_val_acc*100:.2f}%")
        print_progress(f"Model saved to: {save_folder}")
        print_progress("=" * 60)
    
    except Exception as e:
        print_progress(f"ERROR: Training failed - {str(e)}")

        if db_connection and training_id:
            update_training_record(
                db_connection,
                training_id,
                'failed',
                error_msg=str(e)
            )
            db_connection.close()

        import traceback
        print_progress(traceback.format_exc())
        sys.exit(1)


if __name__ == "__main__":
    main()
