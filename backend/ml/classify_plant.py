
import sys
import json
import torch
import torch.nn as nn
import torchvision.transforms as transforms
from torchvision import models
from PIL import Image
from pathlib import Path

#Paths
BASE_DIR = Path(__file__).parent
MODELS_DIR = BASE_DIR / 'models'
ACTIVE_MODEL_FILE = BASE_DIR / 'active_model.txt'

#Device
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

#Image preprocessing - MUST MATCH TRAINING
transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])


def build_model(num_classes):
    """Build ResNet-50 model with custom classifier"""
    model = models.resnet50(weights=None)  
    
    #Custom classifier
    in_features = model.fc.in_features
    model.fc = nn.Sequential(
        nn.Linear(in_features, 512),
        nn.ReLU(),
        nn.Dropout(p=0.3),
        nn.Linear(512, num_classes)
    )
    
    return model


def load_active_model():
    """Load the currently active model"""
    try:
        #Read active model name
        if not ACTIVE_MODEL_FILE.exists():
            return None, None, "No active model set"
        
        with open(ACTIVE_MODEL_FILE, 'r') as f:
            model_name = f.read().strip()
        
        if not model_name:
            return None, None, "Active model file is empty"
        
        model_dir = MODELS_DIR / model_name
        model_path = model_dir / 'best_model.pth'
        label_map_path = model_dir / 'label_map.json'
        
        #Check if files exist
        if not model_path.exists():
            return None, None, f"Model file not found: {model_path}"
        
        if not label_map_path.exists():
            return None, None, f"Label map not found: {label_map_path}"
        
        #Load label map
        with open(label_map_path, 'r') as f:
            label_map_raw = json.load(f)
        
        #Handle both formats: array or object
        if isinstance(label_map_raw, list):
            #Convert array to dict: {0: "species1", 1: "species2", ...}
            label_map = {str(i): name for i, name in enumerate(label_map_raw)}
        elif isinstance(label_map_raw, dict):
            label_map = label_map_raw
        else:
            return None, None, f"Invalid label_map.json format"
        
        num_classes = len(label_map)
        
        #Build model architecture
        model = build_model(num_classes)
        
        #Load trained weights
        state_dict = torch.load(model_path, map_location=device)
        model.load_state_dict(state_dict)
        model.to(device)
        model.eval()
        
        return model, label_map, None
        
    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        return None, None, f"{str(e)}\n{error_detail}"


def classify_image(image_path, model, label_map):
    """Classify a single image"""
    try:
        #Load and preprocess image
        image = Image.open(image_path).convert('RGB')
        image_tensor = transform(image).unsqueeze(0).to(device)
        
        #Predict
        with torch.no_grad():
            outputs = model(image_tensor)
            probabilities = torch.nn.functional.softmax(outputs, dim=1)
            
            #Get top 5 predictions
            top_k = min(5, len(label_map))
            top_probs, top_indices = torch.topk(probabilities, k=top_k)
        
        #Format results
        predictions = []
        for prob, idx in zip(top_probs[0], top_indices[0]):
            class_name = label_map[str(idx.item())]
            predictions.append({
                'species': class_name,
                'confidence': round(prob.item() * 100, 2)
            })
        
        return {
            'success': True,
            'predictions': predictions
        }
        
    except Exception as e:
        import traceback
        error_detail = traceback.format_exc()
        return {
            'success': False,
            'error': f"Classification error: {str(e)}",
            'details': error_detail
        }


def main():
    #Check arguments
    if len(sys.argv) < 2:
        result = {
            'success': False,
            'error': 'Usage: python classify_plant.py <image_path>'
        }
        print(json.dumps(result))
        sys.exit(1)
    
    image_path = sys.argv[1]
    
    #Check if image exists
    if not Path(image_path).exists():
        result = {
            'success': False,
            'error': f'Image file not found: {image_path}'
        }
        print(json.dumps(result))
        sys.exit(1)
    
    #Load model
    model, label_map, error = load_active_model()
    
    if error:
        result = {
            'success': False,
            'error': f'Model loading error: {error}'
        }
        print(json.dumps(result))
        sys.exit(1)
    
    #Classify
    result = classify_image(image_path, model, label_map)
    
    #Output JSON result
    print(json.dumps(result))
    
    #Exit with appropriate code
    sys.exit(0 if result['success'] else 1)


if __name__ == '__main__':
    main()