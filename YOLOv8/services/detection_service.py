import cv2
from ultralytics import YOLO


class DetectionService:
    def __init__(self, model_path="yolov8n.pt", confidence_threshold=0.5):
        self.model = YOLO(model_path)
        self.confidence_threshold = confidence_threshold

    def detect(self, frame):
        """
        Run YOLOv8 detection on a frame.
        Returns (annotated_frame, detections_list).
        """
        results = self.model(frame, conf=self.confidence_threshold, verbose=False)
        result = results[0]

        detections = []
        annotated_frame = frame.copy()

        for box in result.boxes:
            cls_id = int(box.cls[0])
            confidence = float(box.conf[0])
            label = self.model.names[cls_id]
            x1, y1, x2, y2 = map(int, box.xyxy[0])

            detections.append({
                "label": label,
                "confidence": round(confidence, 2),
                "bbox": [x1, y1, x2, y2],
            })

            # Draw bounding box
            color = (0, 255, 0)
            cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), color, 2)
            text = f"{label} {confidence:.2f}"
            cv2.putText(
                annotated_frame, text, (x1, y1 - 10),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2,
            )

        return annotated_frame, detections
