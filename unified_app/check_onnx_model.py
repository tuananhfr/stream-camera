"""
Kiểm tra ONNX model info
Debug tool để xem model structure
"""
import onnxruntime as ort
import numpy as np

def check_model(model_path):
    print("=" * 60)
    print(f"Checking model: {model_path}")
    print("=" * 60)

    try:
        # Load model
        session = ort.InferenceSession(model_path, providers=['CPUExecutionProvider'])

        # Input info
        print("\n[INPUT INFO]")
        for i, inp in enumerate(session.get_inputs()):
            print(f"  [{i}] Name: {inp.name}")
            print(f"      Shape: {inp.shape}")
            print(f"      Type: {inp.type}")

        # Output info
        print("\n[OUTPUT INFO]")
        for i, out in enumerate(session.get_outputs()):
            print(f"  [{i}] Name: {out.name}")
            print(f"      Shape: {out.shape}")
            print(f"      Type: {out.type}")

        # Test inference với dummy input
        print("\n[Testing with dummy input...]")
        input_name = session.get_inputs()[0].name
        input_shape = session.get_inputs()[0].shape

        # Replace dynamic dims with 1
        test_shape = []
        for dim in input_shape:
            if isinstance(dim, str) or dim is None or dim < 0:
                test_shape.append(1)
            else:
                test_shape.append(dim)

        print(f"   Input shape for test: {test_shape}")

        dummy_input = np.random.randn(*test_shape).astype(np.float32)
        output_names = [out.name for out in session.get_outputs()]

        outputs = session.run(output_names, {input_name: dummy_input})

        print("\n[OK] Inference successful!")
        print("\n[Output shapes:]")
        for i, (name, out) in enumerate(zip(output_names, outputs)):
            print(f"   [{i}] {name}: {out.shape}")

        print("\n" + "=" * 60)
        print("Model is valid and loadable!")
        print("=" * 60)

    except Exception as e:
        print(f"\n[ERROR] {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    # Check both models
    print("\n")
    check_model("models/yolov8n.onnx")

    print("\n\n")
    check_model("models/best.onnx")
