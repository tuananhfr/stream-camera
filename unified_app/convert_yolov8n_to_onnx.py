"""
Convert YOLOv8n to ONNX format
Dùng để convert lại model nếu model hiện tại bị lỗi
"""
from ultralytics import YOLO
import logging

logging.basicConfig(level=logging.INFO, format="[%(asctime)s] %(message)s")

def main():
    logging.info("=" * 60)
    logging.info("CONVERT YOLOv8n TO ONNX")
    logging.info("=" * 60)

    # Load YOLOv8n model (sẽ tự download nếu chưa có)
    logging.info("Loading YOLOv8n model...")
    model = YOLO("yolov8n.pt")  # Tự động download từ Ultralytics
    logging.info("✅ Model loaded")

    # Export to ONNX
    logging.info("Exporting to ONNX format...")
    logging.info("This may take a few minutes...")

    try:
        path = model.export(
            format="onnx",
            imgsz=640,  # Input size
            simplify=True,  # Simplify model để chạy nhanh hơn
            opset=12,  # ONNX opset version
            dynamic=False  # Static shape cho CPU
        )

        logging.info("=" * 60)
        logging.info("✅ CONVERSION SUCCESSFUL!")
        logging.info(f"📁 Model saved at: {path}")
        logging.info("=" * 60)
        logging.info("\nNext steps:")
        logging.info(f"1. Copy {path} to unified_app/models/yolov8n.onnx")
        logging.info("2. Run test_vehicle_detection.py to test")
        logging.info("=" * 60)

    except Exception as e:
        logging.error(f"❌ Export failed: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
