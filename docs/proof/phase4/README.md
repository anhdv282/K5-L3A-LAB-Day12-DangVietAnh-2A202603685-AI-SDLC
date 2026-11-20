# Bằng chứng — Phase 4 (Ticket-04, Contract v1.3)

Sinh lại: `./scripts/proof.sh 4` (test, scenario, tất định, perf, bot) · `node scripts/bench.mjs …` → `bench.json` · soak → `soak.json` · `node scripts/e2e.mjs --out docs/proof/phase4/e2e.txt`. Test viết trước khi code: [tdd-red.txt](tdd-red.txt) (chỉ 1 file đỏ vì thiếu module; sau đó 75/75 xanh, [test-report](test-report.txt)).

| # | Yêu cầu | Cách kiểm | Bằng chứng | Kết quả |
|---|---|---|---|---|
| 1 | Contract v1.3 (`bench_cmd`, `soak_cmd`, v1.0–1.2 giữ nguyên) | test `contract 1.3`, `contract sync` | test-report | Đạt |
| 2 | Bench: cảnh chuẩn (200 wander, 100 đom đóm, L1–L3 fuel 100; tắt sinh/sát thương/nhặt/hao dầu/kết thúc) | `bench scene …` (5 phút mô phỏng), ảnh | test-report, [bench-scene.png](img/bench-scene.png) | Đạt |
| 3 | Bench: camera r=30, Y=15, bắt đầu (30,15,0), ngược chiều kim đồng hồ, 15 s/vòng | test `camera path` | test-report | Đạt |
| 4 | Bench: công thức avg_fps / p1_low / p95 | test `frameStats` | test-report | Đạt |
| 5 | Bench: chạy thật, 1280×720, vsync tắt, 3 s khởi động, thoát mã 0 | `node scripts/bench.mjs --seed 42 --duration 30 --out bench.json` | [bench.json](../../../bench.json): avg **555.2** · p1_low **291.2** · p95 2.7 ms · load **596 ms** (các lần chạy trước: 547.7–550.2 FPS, p1 275–291, load 607–640 ms) | Đạt ngưỡng trên **máy tác giả** (Apple M4); máy chấm sẽ khác |
| 6 | Soak: 10 Đêm, seed 7+i, input ngẫu nhiên, 0 crash, RSS ≤ 1.2× | test `soakNight`, `soak CLI` (đúng `soak_cmd`) | [soak.json](../../../soak.json): 0 crash, 14.2 → 15.8 MB (**1.11**) | Đạt **với cờ V8** trong `soak_cmd` |
| 7 | Soak: giải thích RSS | so sánh cờ mặc định | [soak-default-flags.txt](soak-default-flags.txt): 2.04. Heap thật phẳng (~4.5 MB sau 50 Đêm) | Ghi trung thực: không rò rỉ heap, nhưng RSS mặc định trượt ngưỡng |
| 8 | Bảng xếp hạng: tên 3–12 ký tự, top 10, sắp xếp, hòa → ai trước đứng trên, ISO 8601 có múi giờ | test leaderboard ×3 | test-report | Đạt |
| 9 | Lưu trên đĩa, còn sau khi tắt mở lại, `--export-leaderboard` | test `server API … restart`, `export` | test-report, e2e | Đạt |
| 10 | Nhập tên sau khi thua, màn Bảng xếp hạng từ menu | e2e | [e2e.txt](e2e.txt) | Đạt (nhập tên sau **thua** có e2e; sau **Bình Minh** dùng cùng hàm `saveScore` nhưng chưa có e2e riêng) |
| 11 | Đổi phím 9 hành động, báo trùng, khôi phục mặc định, được lưu | e2e | e2e.txt | Đạt |
| 12 | Phụ đề + mũi tên: Bóng Mực, gió, 10 s cuối, dầu < 30 | e2e | e2e.txt | Đạt |
| 13 | Giảm chuyển động (không chớp màn hình, không rung camera) | e2e (flash); rung camera: đọc code | e2e.txt | Đạt (rung camera chưa có kiểm tự động) |
| 14 | Chữ ≥ 18 px, chữ lớn ×1.25 | e2e quét mọi phần tử chữ (computed style); test tĩnh stylesheet | e2e.txt | Đạt |
| 15 | README ≤ 3 lệnh, CHANGELOG 4 phase, CREDITS, LICENSE | đọc file; clone sạch (xem checklist release) | repo | Đạt (clone sạch: xem mục dưới) |
| 16 | Hồi quy Phase 1–3 | `phase1-regression`, `phase2`, `phase3` tests; tất định ×3 | [determinism.txt](determinism.txt) | Đạt: IDENTICAL ×3 |
| 17 | Release v1.0.0, video ≤ 5 phút | chưa làm lúc viết mục này | — | **Chưa** (xem trạng thái cuối) |
