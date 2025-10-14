# Convert your Keras model to TensorFlow Lite
import tensorflow as tf

# Load your Keras model
model = tf.keras.models.load_model('plantClassificationModel.keras')

# Convert to TensorFlow Lite with optimization
converter = tf.lite.TFLiteConverter.from_keras_model(model)
converter.optimizations = [tf.lite.Optimize.DEFAULT]

# Optional: Use float16 quantization for smaller size
converter.target_spec.supported_types = [tf.float16]

tflite_model = converter.convert()

# Save the model
with open('plant_classifier.tflite', 'wb') as f:
    f.write(tflite_model)

# Also save labels
import json
labels = ["Rafflesia tuan-mudae",
  "acalypha hispida",
  "asplenium nidus",
  "bambusa vulgaris",
  "bougainvillea spectabilis",
  "bulbophyllum beccarii",
  "coelogyne nitida",
  "cordyline fruticosa",
  "couroupita guianensis",
  "cycas revoluta",
  "dendrobium nobile",
  "dipteris conjugata",
  "elaeis guineensis",
  "eusideroxylon zwageri",
  "heliconia rostrata",
  "hibiscus rosa-sinensis",
  "hymenocallis littoralis",
  "ixora",
  "licuala orbicularis",
  "nepenthes lowii",
  "nepenthes rajah",
  "nypa fruticans",
  "paphiopedilum sanderianum",
  "phalaenopsis bellina",
  "phalaenopsis gigantea",
  "piper nigrum",
  "polyalthia longifolia",
  "pteridium aquilinum",
  "rhizophora apiculata",
  "zingiber officinale"] 
with open('labels.json', 'w') as f:
    json.dump(labels, f)