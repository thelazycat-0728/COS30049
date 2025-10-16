import os
import json
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader
from torchvision import datasets, transforms, models
from pathlib import Path
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


def validate_training_data(dataset_path):
    """Validate training dataset structure"""
    try:
        dataset_path = Path(dataset_path)
        
        if not dataset_path.exists():
            return {
                'valid': False,
                'error': f'Dataset path does not exist: {dataset_path}'
            }
        
        # Check for class directories
        class_dirs = [d for d in dataset_path.iterdir() if d.is_dir()]
        
        if len(class_dirs) == 0:
            return {
                'valid': False,
                'error': 'No class directories found in dataset'
            }
        
        # Count images per class
        class_counts = {}
        total_images = 0
        
        for class_dir in class_dirs:
            images = list(class_dir.glob('*.jpg')) + \
                    list(class_dir.glob('*.jpeg')) + \
                    list(class_dir.glob('*.png'))
            
            class_counts[class_dir.name] = len(images)
            total_images += len(images)
        
        return {
            'valid': True,
            'num_classes': len(class_dirs),
            'total_images': total_images,
            'class_counts': class_counts
        }
    
    except Exception as e:
        return {
            'valid': False,
            'error': str(e)
        }


def train_model(
    dataset_path,
    model_name,
    epochs=50,
    batch_size=32,
    learning_rate=0.001,
    output_dir='./models',
    callback=None
):
    """Train MobileNetV2 model"""
    
    logger.info("=" * 60)
    logger.info("STARTING MODEL TRAINING")
    logger.info("=" * 60)
    
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    logger.info(f"Device: {device}")
    logger.info(f"Model name: {model_name}")
    logger.info(f"Output directory: {output_dir}")
    
    # Transforms
    train_transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.RandomHorizontalFlip(),
        transforms.RandomRotation(15),
        transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    ])
    
    val_transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    ])
    
    # Load dataset
    logger.info(f"Loading dataset: {dataset_path}")
    full_dataset = datasets.ImageFolder(root=dataset_path, transform=train_transform)
    
    # Split
    train_size = int(0.8 * len(full_dataset))
    val_size = len(full_dataset) - train_size
    train_dataset, val_dataset = torch.utils.data.random_split(
        full_dataset, [train_size, val_size]
    )
    val_dataset.dataset.transform = val_transform
    
    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False, num_workers=0)
    
    num_classes = len(full_dataset.classes)
    total_images = len(full_dataset)
    logger.info(f"Classes: {num_classes}, Train: {train_size}, Val: {val_size}")
    logger.info(f"Total images: {total_images}")
    
    # Model
    model = models.mobilenet_v2(pretrained=True)
    model.classifier[1] = nn.Linear(model.last_channel, num_classes)
    model = model.to(device)
    
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=learning_rate)
    scheduler = optim.lr_scheduler.StepLR(optimizer, step_size=10, gamma=0.1)
    
    best_accuracy = 0.0
    best_epoch = 0
    history = {
        'train_loss': [],
        'train_accuracy': [],
        'val_loss': [],
        'val_accuracy': []
    }
    
    # ✅ Create model directory BEFORE training
    model_dir = Path(output_dir) / model_name
    model_dir.mkdir(parents=True, exist_ok=True)
    logger.info(f"📁 Model directory: {model_dir.absolute()}")
    
    # Training loop
    for epoch in range(epochs):
        logger.info(f"\nEpoch {epoch + 1}/{epochs}")
        logger.info("-" * 60)
        
        # Train phase
        model.train()
        train_loss = 0.0
        train_correct = 0
        train_total = 0
        
        for batch_idx, (inputs, labels) in enumerate(train_loader):
            inputs, labels = inputs.to(device), labels.to(device)
            
            optimizer.zero_grad()
            outputs = model(inputs)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()
            
            train_loss += loss.item()
            _, predicted = outputs.max(1)
            train_total += labels.size(0)
            train_correct += predicted.eq(labels).sum().item()
            
            if (batch_idx + 1) % 10 == 0:
                logger.info(
                    f"  Batch {batch_idx + 1}/{len(train_loader)} | "
                    f"Loss: {loss.item():.4f} | "
                    f"Acc: {100. * train_correct / train_total:.2f}%"
                )
        
        avg_train_loss = train_loss / len(train_loader)
        train_accuracy = 100. * train_correct / train_total
        
        # Validation phase
        model.eval()
        val_loss = 0.0
        val_correct = 0
        val_total = 0
        
        with torch.no_grad():
            for inputs, labels in val_loader:
                inputs, labels = inputs.to(device), labels.to(device)
                outputs = model(inputs)
                loss = criterion(outputs, labels)
                
                val_loss += loss.item()
                _, predicted = outputs.max(1)
                val_total += labels.size(0)
                val_correct += predicted.eq(labels).sum().item()
        
        avg_val_loss = val_loss / len(val_loader)
        val_accuracy = 100. * val_correct / val_total
        
        # Log results
        logger.info(f"Train Loss: {avg_train_loss:.4f} | Train Acc: {train_accuracy:.2f}%")
        logger.info(f"Val Loss: {avg_val_loss:.4f} | Val Acc: {val_accuracy:.2f}%")
        
        # Update history
        history['train_loss'].append(avg_train_loss)
        history['train_accuracy'].append(train_accuracy)
        history['val_loss'].append(avg_val_loss)
        history['val_accuracy'].append(val_accuracy)
        
        # Callback
        if callback:
            try:
                callback(
                    epoch + 1,
                    epochs,
                    avg_train_loss,
                    train_accuracy,
                    avg_val_loss,
                    val_accuracy
                )
            except Exception as e:
                logger.error(f"Callback error: {str(e)}")
        
        # ✅ Save best model in the model_name folder
        if val_accuracy > best_accuracy:
            best_accuracy = val_accuracy
            best_epoch = epoch + 1
            
            # Save model file: models/model_name/model_name.pth
            model_path = model_dir / f'{model_name}.pth'
            torch.save({
                'epoch': epoch,
                'model_state_dict': model.state_dict(),
                'optimizer_state_dict': optimizer.state_dict(),
                'train_accuracy': train_accuracy,
                'val_accuracy': val_accuracy,
                'best_accuracy': best_accuracy,
                'num_classes': num_classes,
                'class_names': full_dataset.classes
            }, model_path)
            
            logger.info(f"✅ Saved best model: {model_path}")
        
        scheduler.step()
    
    # ✅ Save final files in the model folder
    
    # 1. Save label_map.json
    label_path = model_dir / 'label_map.json'
    with open(label_path, 'w') as f:
        json.dump(full_dataset.classes, f, indent=2)
    logger.info(f"✅ Saved labels: {label_path}")
    
    # 2. Save training_results.json
    result_path = model_dir / 'training_results.json'
    with open(result_path, 'w') as f:
        json.dump({
            'model_name': model_name,
            'epochs': epochs,
            'best_epoch': best_epoch,
            'best_accuracy': best_accuracy,
            'final_train_accuracy': history['train_accuracy'][-1],
            'final_val_accuracy': history['val_accuracy'][-1],
            'num_classes': num_classes,
            'total_images': total_images,
            'train_images': train_size,
            'val_images': val_size,
            'class_names': full_dataset.classes,
            'history': history,
            'hyperparameters': {
                'epochs': epochs,
                'batch_size': batch_size,
                'learning_rate': learning_rate
            },
            'created_at': datetime.now().isoformat()
        }, f, indent=2)
    logger.info(f"✅ Saved training results: {result_path}")
    
    logger.info("=" * 60)
    logger.info(f"TRAINING COMPLETED")
    logger.info(f"  Model: {model_name}")
    logger.info(f"  Best Epoch: {best_epoch}/{epochs}")
    logger.info(f"  Best Accuracy: {best_accuracy:.2f}%")
    logger.info(f"  Model saved to: {model_dir.absolute()}")
    logger.info("=" * 60)
    
    # Get final validation accuracy
    final_val_accuracy = history['val_accuracy'][-1] if history['val_accuracy'] else 0
    
    # ✅ Return complete information
    return {
        'model_path': str(model_path),
        'label_path': str(label_path),
        'results_path': str(result_path),
        'best_accuracy': best_accuracy,
        'val_accuracy': final_val_accuracy,
        'num_classes': num_classes,
        'total_images': total_images,
        'history': history,
        'model_dir': str(model_dir.absolute())
    }