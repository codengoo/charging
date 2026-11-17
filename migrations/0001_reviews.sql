-- Đánh giá + bình luận công khai cho từng trạm (worker/reviews.ts).
-- reviews: một hàng cho mỗi cặp (trạm, thiết bị) — ý kiến hiện tại của một người về một trạm;
-- sửa là ghi đè. review_reports: một hàng cho mỗi cặp (bài, thiết bị báo cáo).

CREATE TABLE reviews (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  station_id   TEXT    NOT NULL,              -- entityId VinFast
  device_hash  TEXT    NOT NULL,              -- hex SHA-256(deviceId + REVIEW_PEPPER), không lưu deviceId gốc
  nickname     TEXT    NOT NULL,
  rating       INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body         TEXT    NOT NULL DEFAULT '',
  created_at   INTEGER NOT NULL,              -- epoch ms
  updated_at   INTEGER NOT NULL,
  hidden       INTEGER NOT NULL DEFAULT 0,    -- 0 hiện, 1 tự ẩn do báo cáo, 2 admin ẩn
  report_count INTEGER NOT NULL DEFAULT 0,
  UNIQUE (station_id, device_hash)
);
CREATE INDEX reviews_station ON reviews (station_id, hidden, updated_at DESC);
CREATE INDEX reviews_hidden ON reviews (hidden, updated_at DESC);

CREATE TABLE review_reports (
  review_id   INTEGER NOT NULL REFERENCES reviews (id) ON DELETE CASCADE,
  device_hash TEXT    NOT NULL,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (review_id, device_hash)
);
