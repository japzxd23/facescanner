# Face-API.js Models

This directory should contain the face-api.js model files.

Download the following models from the face-api.js repository:
- `tiny_face_detector_model-weights_manifest.json`
- `tiny_face_detector_model-shard1`
- `face_landmark_68_model-weights_manifest.json`
- `face_landmark_68_model-shard1`
- `face_recognition_model-weights_manifest.json`
- `face_recognition_model-shard1`
- `face_recognition_model-shard2`
- `face_expression_model-weights_manifest.json`
- `face_expression_model-shard1`

You can download them from: https://github.com/justadudewhohacks/face-api.js/tree/master/weights

Or use this command from the project root:
```bash
# Download models (requires curl)
curl -L https://github.com/justadudewhohacks/face-api.js/raw/master/weights/tiny_face_detector_model-weights_manifest.json -o public/models/tiny_face_detector_model-weights_manifest.json
curl -L https://github.com/justadudewhohacks/face-api.js/raw/master/weights/tiny_face_detector_model-shard1 -o public/models/tiny_face_detector_model-shard1
curl -L https://github.com/justadudewhohacks/face-api.js/raw/master/weights/face_landmark_68_model-weights_manifest.json -o public/models/face_landmark_68_model-weights_manifest.json
curl -L https://github.com/justadudewhohacks/face-api.js/raw/master/weights/face_landmark_68_model-shard1 -o public/models/face_landmark_68_model-shard1
curl -L https://github.com/justadudewhohacks/face-api.js/raw/master/weights/face_recognition_model-weights_manifest.json -o public/models/face_recognition_model-weights_manifest.json
curl -L https://github.com/justadudewhohacks/face-api.js/raw/master/weights/face_recognition_model-shard1 -o public/models/face_recognition_model-shard1
curl -L https://github.com/justadudewhohacks/face-api.js/raw/master/weights/face_recognition_model-shard2 -o public/models/face_recognition_model-shard2
curl -L https://github.com/justadudewhohacks/face-api.js/raw/master/weights/face_expression_model-weights_manifest.json -o public/models/face_expression_model-weights_manifest.json
curl -L https://github.com/justadudewhohacks/face-api.js/raw/master/weights/face_expression_model-shard1 -o public/models/face_expression_model-shard1
```