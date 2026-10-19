import cv2
from ultralytics import YOLO

class StudentDetector:
    def __init__(self, model_path="yolov8n.pt", conf_threshold=0.5):
        """
        Initializes the YOLO student/person detector.
        """
        self.model = YOLO(model_path)
        self.conf_threshold = conf_threshold
        self.person_class_id = 0  

    def detect(self, frame):
        """
        Runs detection on a frame.
        Returns:
            count (int): Number of detected students
            annotated_frame: OpenCV frame with bounding boxes & labels
            boxes (list): List of detected bounding boxes [(x1, y1, x2, y2, conf), ...]
        """
        
        results = self.model(
            frame, 
            classes=[self.person_class_id], 
            conf=self.conf_threshold, 
            verbose=False
        )

        annotated_frame = frame.copy()
        student_count = 0
        boxes = []

        for r in results:
            for box in r.boxes:
                student_count += 1
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                conf = float(box.conf[0])
                boxes.append((x1, y1, x2, y2, conf))

                cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                
                label = f"Student: {conf:.2f}"
                cv2.rectangle(annotated_frame, (x1, y1 - 22), (x1 + 120, y1), (0, 255, 0), -1)
                cv2.putText(
                    annotated_frame, label, (x1 + 5, y1 - 6),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 0, 0), 1, cv2.LINE_AA
                )

        return student_count, annotated_frame, boxes
