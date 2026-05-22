import cv2
import os
import time
import threading


class CameraService:
    def __init__(self, detection_service, camera_index=0):
        self.detection_service = detection_service
        self.camera_index = camera_index
        self.camera = None
        self.is_running = False
        self.lock = threading.Lock()

    def _open_camera(self):
        if self.camera is None or not self.camera.isOpened():
            self.camera = cv2.VideoCapture(self.camera_index)
            self.camera.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
            self.camera.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        return self.camera.isOpened()

    def start(self):
        with self.lock:
            if self._open_camera():
                self.is_running = True

    def stop(self):
        with self.lock:
            self.is_running = False
            if self.camera and self.camera.isOpened():
                self.camera.release()
                self.camera = None

    def generate_frames(self):
        """Generator that yields JPEG frames with YOLO detections for live streaming."""
        self.start()
        try:
            while self.is_running:
                with self.lock:
                    if self.camera is None or not self.camera.isOpened():
                        break
                    success, frame = self.camera.read()
                if not success:
                    break

                # Run detection and draw bounding boxes
                annotated_frame, _ = self.detection_service.detect(frame)

                _, buffer = cv2.imencode(".jpg", annotated_frame)
                frame_bytes = buffer.tobytes()

                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n\r\n" + frame_bytes + b"\r\n"
                )
        finally:
            pass  # Camera released via stop()

    def capture_and_detect(self, save_dir):
        """Capture a single frame, detect objects, save annotated image, return results."""
        with self.lock:
            if not self._open_camera():
                return None
            success, frame = self.camera.read()

        if not success:
            return None

        annotated_frame, detections = self.detection_service.detect(frame)

        # Save the annotated image
        timestamp = int(time.time() * 1000)
        filename = f"capture_{timestamp}.jpg"
        filepath = os.path.join(save_dir, filename)
        cv2.imwrite(filepath, annotated_frame)

        return {
            "image_url": f"/static/captured/{filename}",
            "detections": detections,
        }
