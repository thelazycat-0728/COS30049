import os
import json
import logging
import threading
from datetime import datetime
from pathlib import Path
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import torch
from werkzeug.utils import secure_filename
import requests

# Load environment variables
load_dotenv()

# Import scripts
from scripts.train import train_model, validate_training_data
# from scripts.inference import predict_image
# from scripts.plotting import generate_training_plot

# Initialize Flask
app = Flask(__name__)
CORS(app, origins=[os.getenv('BACKEND_URL', 'http://localhost:5000')])

# Configuration
app.config['UPLOAD_FOLDER'] = os.getenv('UPLOAD_DIR', './uploads')
app.config['MODEL_FOLDER'] = os.getenv('MODEL_DIR', './models')
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100 MB

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/ai-server.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Create directories
Path(app.config['UPLOAD_FOLDER']).mkdir(parents=True, exist_ok=True)
Path(app.config['MODEL_FOLDER']).mkdir(parents=True, exist_ok=True)
Path('logs').mkdir(exist_ok=True)

# Global training state
training_state = {
    'is_training': False,
    'current_epoch': 0,
    'total_epochs': 0,
    'train_loss': 0.0,
    'train_accuracy': 0.0,
    'val_loss': 0.0,
    'val_accuracy': 0.0,
    'progress': 0,
    'message': 'Idle',
    'model_name': None,
    'history': {
        'train_loss': [],
        'train_accuracy': [],
        'val_loss': [],
        'val_accuracy': []
    }
}

training_thread = None


# ============================================
# Authentication Middleware
# ============================================
def require_api_key(f):
    from functools import wraps
    
    @wraps(f)
    def decorated_function(*args, **kwargs):
        api_key = request.headers.get('X-API-Key')
        
        if not api_key or api_key != os.getenv('API_KEY'):
            return jsonify({
                'success': False,
                'error': 'Invalid or missing API key'
            }), 401
        
        return f(*args, **kwargs)
    
    return decorated_function


# ============================================
# Health Check
# ============================================
@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'ai-server',
        'version': '1.0.0',
        'timestamp': datetime.now().isoformat(),
        'gpu_available': torch.cuda.is_available(),
        'device': str(torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'CPU'),
        'is_training': training_state['is_training']
    })


# ============================================
# Training Endpoints
# ============================================
@app.route('/api/train/start', methods=['POST'])
@require_api_key
def start_training():
    """Start model training"""
    global training_state, training_thread
    
    try:
        if training_state['is_training']:
            return jsonify({
                'success': False,
                'error': 'Training already in progress',
                'status': training_state
            }), 409
        
        data = request.get_json()
        
        dataset_path = data.get('dataset_path', app.config['UPLOAD_FOLDER'])
        epochs = data.get('epochs', int(os.getenv('EPOCHS', 50)))
        batch_size = data.get('batch_size', int(os.getenv('BATCH_SIZE', 32)))
        learning_rate = data.get('learning_rate', float(os.getenv('LEARNING_RATE', 0.001)))
        model_name = data.get('model_name', f'model_{datetime.now().strftime("%Y%m%d_%H%M%S")}')
        
        logger.info(f"📚 Training request: {model_name}")
        logger.info(f"   Dataset: {dataset_path}")
        logger.info(f"   Epochs: {epochs}, Batch: {batch_size}, LR: {learning_rate}")
        
        # Validate dataset
        validation = validate_training_data(dataset_path)
        if not validation['valid']:
            return jsonify({
                'success': False,
                'error': 'Invalid dataset',
                'details': validation
            }), 400
        
        # Reset training state
        training_state.update({
            'is_training': True,
            'current_epoch': 0,
            'total_epochs': epochs,
            'train_loss': 0.0,
            'train_accuracy': 0.0,
            'val_loss': 0.0,
            'val_accuracy': 0.0,
            'progress': 0,
            'message': 'Training started',
            'model_name': model_name,
            'history': {
                'train_loss': [],
                'train_accuracy': [],
                'val_loss': [],
                'val_accuracy': []
            }
        })
        
        # Start training in background
        def train_background():
            global training_state
            try:
                result = train_model(
                    dataset_path=dataset_path,
                    model_name=model_name,
                    epochs=epochs,
                    batch_size=batch_size,
                    learning_rate=learning_rate,
                    output_dir=app.config['MODEL_FOLDER'],
                    callback=update_training_progress
                )
                
                training_state.update({
                    'is_training': False,
                    'progress': 100,
                    'message': 'Training completed',
                    'result': result
                })
                
                logger.info(f"✅ Training completed: {model_name}")

                notify_backend_training_complete(result, model_name)
                
            except Exception as e:
                logger.error(f"❌ Training failed: {str(e)}")
                training_state.update({
                    'is_training': False,
                    'message': f'Training failed: {str(e)}',
                    'error': str(e)
                })
        
                try:
                    backend_url = os.getenv('BACKEND_URL', 'http://localhost:5000')
                    api_key = os.getenv('API_KEY')
                    
                    requests.put(
                        f'{backend_url}/admin/train/finished',
                        json={
                            'modelName': model_name,
                            'status': 'failed',
                            'error': str(e)
                        },
                        headers={
                            'Content-Type': 'application/json',
                            'X-API-Key': api_key
                        },
                        timeout=10
                    )
                except:
                    pass
        training_thread = threading.Thread(target=train_background, daemon=True)
        training_thread.start()
        
        return jsonify({
            'success': True,
            'message': 'Training started',
            'status': training_state
        })
    
    except Exception as e:
        logger.error(f"❌ Failed to start training: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


def update_training_progress(epoch, total_epochs, train_loss, train_acc, val_loss, val_acc):
    """Callback to update training progress"""
    global training_state
    
    training_state.update({
        'current_epoch': epoch,
        'total_epochs': total_epochs,
        'train_loss': float(train_loss),
        'train_accuracy': float(train_acc),
        'val_loss': float(val_loss),
        'val_accuracy': float(val_acc),
        'progress': int((epoch / total_epochs) * 100),
        'message': f'Training epoch {epoch}/{total_epochs}'
    })
    
    # Update history
    training_state['history']['train_loss'].append(float(train_loss))
    training_state['history']['train_accuracy'].append(float(train_acc))
    training_state['history']['val_loss'].append(float(val_loss))
    training_state['history']['val_accuracy'].append(float(val_acc))

def notify_backend_training_complete(result, model_name):
    """Notify backend when training is complete"""
    try:
        backend_url = os.getenv('BACKEND_URL', 'http://localhost:5000')
        api_key = os.getenv('API_KEY')
      
        # Prepare payload
        payload = {
            'modelName': model_name,
            'status': 'completed',
            'speciesCount': result.get('num_classes', 0),
            'totalImages': result.get('total_images', 0),
            'trainAccuracy': round(result.get('best_accuracy', 0), 2),
            'valAccuracy': round(result.get('val_accuracy', 0), 2),
            'modelPath': result.get('model_path', ''),
            'labelPath': result.get('label_path', ''),
            'history': result.get('history', {})
        }
        
        logger.info(f"📤 Sending training results to backend: {backend_url}")
        logger.info(f"   Model: {model_name}")
        logger.info(f"   Species: {payload['speciesCount']}")
        logger.info(f"   Images: {payload['totalImages']}")
        logger.info(f"   Train Acc: {payload['trainAccuracy']}%")
        logger.info(f"   Val Acc: {payload['valAccuracy']}%")
        
        response = requests.put(
            f'{backend_url}/admin/train/finished',
            json=payload,
            headers={
                'Content-Type': 'application/json',
                'X-API-Key': api_key
            },
            timeout=10
        )
        
        if response.status_code == 200:
            logger.info(f"✅ Backend notified successfully")
        else:
            logger.error(f"❌ Backend notification failed: {response.status_code}")
            logger.error(f"   Response: {response.text}")
            
    except Exception as e:
        logger.error(f"❌ Failed to notify backend: {str(e)}")


@app.route('/api/train/status', methods=['GET'])
@require_api_key
def get_training_status():
    """Get current training status"""
    return jsonify({
        'success': True,
        'status': training_state
    })


@app.route('/api/train/stop', methods=['POST'])
@require_api_key
def stop_training():
    """Stop ongoing training"""
    global training_state
    
    if not training_state['is_training']:
        return jsonify({
            'success': False,
            'error': 'No training in progress'
        }), 400
    
    # TODO: Implement proper training cancellation
    training_state['is_training'] = False
    training_state['message'] = 'Training stopped by user'
    
    logger.info("🛑 Training stopped")
    
    return jsonify({
        'success': True,
        'message': 'Training stopped'
    })


# ============================================
# Inference Endpoints
# ============================================
@app.route('/api/predict', methods=['POST'])
@require_api_key
def predict():
    """Predict plant species from image"""
    try:
        if 'image' not in request.files:
            return jsonify({
                'success': False,
                'error': 'No image file provided'
            }), 400
        
        file = request.files['image']
        
        if file.filename == '':
            return jsonify({
                'success': False,
                'error': 'No file selected'
            }), 400
        
        # Save file
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        
        logger.info(f"🔍 Predicting: {filename}")
        
        # Predict
        model_path = os.getenv('MODEL_PATH')
        labels_path = os.getenv('LABELS_PATH')
        
        predictions = predict_image(
            image_path=filepath,
            model_path=model_path,
            labels_path=labels_path,
            top_k=5
        )
        
        # Cleanup
        os.remove(filepath)
        
        return jsonify({
            'success': True,
            'predictions': predictions,
            'source': 'ai-server',
            'model': 'mobilenetv2'
        })
    
    except Exception as e:
        logger.error(f"❌ Prediction failed: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


# ============================================
# Model Management
# ============================================
@app.route('/api/models', methods=['GET'])
@require_api_key
def list_models():
    """List all trained models"""
    try:
        models_dir = Path(app.config['MODEL_FOLDER'])
        models = []
        
        for model_dir in models_dir.iterdir():
            if model_dir.is_dir():
                pth_files = list(model_dir.glob('*.pth'))
                if pth_files:
                    model_file = pth_files[0]
                    stat = model_file.stat()
                    
                    # Check for results file
                    results_file = model_dir / 'training_results.json'
                    results = {}
                    if results_file.exists():
                        with open(results_file) as f:
                            results = json.load(f)
                    
                    models.append({
                        'name': model_dir.name,
                        'path': str(model_file),
                        'size': stat.st_size,
                        'modified': datetime.fromtimestamp(stat.st_mtime).isoformat(),
                        'accuracy': results.get('best_accuracy'),
                        'epochs': results.get('epochs'),
                        'num_classes': results.get('num_classes')
                    })
        
        return jsonify({
            'success': True,
            'models': models
        })
    
    except Exception as e:
        logger.error(f"❌ Failed to list models: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/models/<model_name>', methods=['DELETE'])
@require_api_key
def delete_model(model_name):
    """Delete a model"""
    try:
        model_path = Path(app.config['MODEL_FOLDER']) / model_name
        
        if not model_path.exists():
            return jsonify({
                'success': False,
                'error': 'Model not found'
            }), 404
        
        # Delete directory
        import shutil
        shutil.rmtree(model_path)
        
        logger.info(f"🗑️  Deleted model: {model_name}")
        
        return jsonify({
            'success': True,
            'message': f'Model {model_name} deleted'
        })
    
    except Exception as e:
        logger.error(f"❌ Failed to delete model: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/models/<model_name>/plot', methods=['GET'])
@require_api_key
def get_model_plot(model_name):
    """Get training plot for a model"""
    try:
        model_dir = Path(app.config['MODEL_FOLDER']) / model_name
        results_file = model_dir / 'training_results.json'
        
        if not results_file.exists():
            return jsonify({
                'success': False,
                'error': 'Training results not found'
            }), 404
        
        with open(results_file) as f:
            results = json.load(f)
        
        # Generate plot
        plot_path = generate_training_plot(results, str(model_dir))
        
        return jsonify({
            'success': True,
            'plot_url': f'/static/plots/{model_name}.png',
            'plot_path': plot_path
        })
    
    except Exception as e:
        logger.error(f"❌ Failed to generate plot: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


# ============================================
# Error Handlers
# ============================================
@app.errorhandler(404)
def not_found(error):
    return jsonify({
        'success': False,
        'error': 'Endpoint not found'
    }), 404


@app.errorhandler(500)
def internal_error(error):
    logger.error(f"Internal error: {str(error)}")
    return jsonify({
        'success': False,
        'error': 'Internal server error'
    }), 500


# ============================================
# Main
# ============================================
if __name__ == '__main__':
    port = int(os.getenv('PORT', 8000))
    host = os.getenv('HOST', '0.0.0.0')
    debug = os.getenv('FLASK_ENV') == 'development'
    
    logger.info("=" * 60)
    logger.info(f"🤖 Starting AI Server on {host}:{port}")
    logger.info(f"📊 Model: {os.getenv('MODEL_PATH')}")
    logger.info(f"🏷️  Labels: {os.getenv('LABELS_PATH')}")
    logger.info(f"🖥️  Device: {'GPU - ' + torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'CPU'}")
    logger.info("=" * 60)
    
    app.run(host=host, port=port, debug=debug, threaded=True)