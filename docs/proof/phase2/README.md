# Bằng chứng — Phase 2 (Ticket-02)

Sinh tự động: `./scripts/proof.sh 2` (không sửa tay). Ảnh: Chrome headless (SwiftShader), xem skill `.claude/skills/verify`.

| # | Yêu cầu | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|---|
| 1 | Số liệu chuẩn trong contract 1.1 (`game.contract.json`) | test `contract 1.1: standard tuning values` | [test-report](test-report.txt) | Đạt |
| 2 | Bản đồ chuẩn Đêm 1/2/3 (đèn, điểm sinh, cầu, tầng, dốc, tháp) | test `night 1 map`, `night 3 terrain`, `night chain data`; ảnh | [n1.png](img/n1.png) [n2.png](img/n2.png) [n3.png](img/n3.png) | Đạt |
| 3 | Chạy 6 m/s, tăng tốc/dừng ≤ 0.1 s; nhảy 7 m/s, g −20 | test `run`, `jump` | test-report | Đạt |
| 4 | Lướt | test dash ×2; scenario `p2_dash` | [p2_dash.json](p2_dash.json) | Đạt |
| 5 | Bục nhảy Đêm 2/3 | test launch pad ×2 | test-report | Đạt |
| 6 | Rơi khỏi đảo + hồi sinh | test `fall off island` | test-report | Đạt |
| 7 | Tỏa Sáng chuẩn (3D, choáng 120, đẩy 4 m/15 tick, +5) | test `pulse` | test-report | Đạt |
| 8 | Bóng Mực: trạng thái, chạm, recoil, lịch sinh | test `shade states`, `shade touch` | test-report | Đạt |
| 9 | Vùng an toàn 6 m, đẩy ra ≤ 30 tick | test `safe zone` | test-report | Đạt |
| 10 | Gió Lạc | test drifter ×2; scenario `p2_drifter` | [p2_drifter.json](p2_drifter.json) | Đạt |
| 11 | Bùa Gió | test `charm` | test-report | Đạt |
| 12 | Gió mạnh Đêm 3 | test `wind` | test-report | Đạt |
| 13 | Tạm dừng (logic) | test `pause`; scenario `p2_pause` (snapshot `paused`) | [p2_pause.json](p2_pause.json) | Đạt |
| 14 | Thứ tự xét thắng/thua | test `win/lose order` | test-report | Đạt |
| 15 | Tất định | 3 Đêm × 2 lần chạy, so hash | [determinism.txt](determinism.txt) | Đạt |
| 16 | Headless 21.600 tick ≤ 30 s | test `performance` + đo | [perf.txt](perf.txt) (~0.2 s, Apple M4) | Đạt |
| 17 | Chuỗi 3 Đêm, menu, giới thiệu Ông Đăng, Bình Minh, chơi lại Đêm | kiểm tay trong trình duyệt; ảnh menu | [menu.png](img/menu.png) | Đạt về code, **chưa có ảnh từng màn** |
| 18 | Menu tạm dừng + Cài đặt lưu `localStorage` | kiểm tay | — | **Chưa có bằng chứng ảnh/video** |
| 19 | HUD đầy đủ (lửa, đồng hồ, đèn/điểm, thanh 10 ô, hồi chiêu, nhắc E, mũi tên) | ảnh | [n1.png](img/n1.png) (thấy mũi tên chỉ đèn ở góc trái dưới) | Đạt (đồng hồ đỏ ≤ 30 s chưa chụp) |
| 20 | Bảng màu chuẩn | màu lấy từ hằng `C` trong `src/web/main.js` (đúng hex ticket) | ảnh | Đạt (chưa đo pixel) |
| 21 | Âm thanh đủ danh sách | `src/web/audio.js` có sfx: nhặt, thắp, tỏa sáng, bị đánh, nhảy, lướt, thắng, thua, Bóng Mực xuất hiện, đếm ngược 10 s | kiểm tay | Đạt về code, chưa có bằng chứng ghi âm |
| 22 | ≥ 30 FPS trung bình ở 1280×720 | `node scripts/fps.mjs <night> 20`: Chrome GPU thật (Metal, Apple M4), viewport ép 1280×720, bot tự chơi 20 s | [fps.txt](fps.txt) | Đạt: 60.0 / 59.8 / 60.1 FPS (Đêm 1/2/3, bị giới hạn vsync 60) |
| 23 | Chơi được tới cuối | bot tự chơi 6 seed/Đêm | [bot-nights.txt](bot-nights.txt) | Đêm 1: bot thắng 4/6. Đêm 2, 3: **bot chưa thắng** (bot đơn giản, chưa né Gió Lạc/địa hình tốt). Người chơi có thể thắng; chưa có bằng chứng tự động |
| 24 | Đồng bộ Test Contract (`game.contract.json`) | test `contract sync` ×3: mọi khóa `tuning` được logic đọc; đổi giá trị thì hành vi đổi; lệnh `headless_cmd` chạy được | test-report | Đạt. Định dạng tham số/JSON headless do mình định nghĩa (A0) |

## Chống hồi quy Phase 1 và tách tầng
| # | Kiểm tra | Bằng chứng | Kết quả |
|---|---|---|---|
| R1 | 3 scenario Phase 1 (chép từ tag `phase-1`) chạy trên code hiện tại, đủ trường đầu ra Phase 1, tất định | `tests/phase1-regression.test.js` (6 test), [test-report](test-report.txt) | Đạt 100 % |
| R2 | Cờ CLI Phase 1 (`--seed --bot --max-seconds --events --out`) còn chạy | như trên | Đạt |
| R3 | Logic không phụ thuộc đồ họa/DOM/đồng hồ/random | `tests/architecture.test.js` | Đạt |
| R4 | Luật chuỗi Đêm + tổng điểm nằm trong `src/core/campaign.js` | `tests/campaign.test.js` | Đạt |
| R5 | Không dùng audio có bản quyền | `tests/architecture.test.js` (không còn tham chiếu `.mp3`) | Đạt |
| R6 | Viết test trước khi code (đợt sửa này) | [tdd-red.txt](tdd-red.txt): 9 đỏ trước khi code, sau đó 42/42 | Đạt |
