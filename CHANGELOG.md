# Changelog

## Phase 4 — Ticket-04 "Phát hành" (Contract v1.3) → v1.0.0

### Thêm
- **Contract v1.3:** `bench_cmd`, `soak_cmd`; `run_cmd` đổi thành `node server.js` để nhận `--export-leaderboard` (`npm start` vẫn dùng được). Mọi khóa v1.0–v1.2 giữ nguyên.
- **Benchmark** (`scripts/bench.mjs`, `src/core/bench.js`): cảnh chuẩn Đêm 1 (200 Bóng Mực wander, 100 đom đóm, L1–L3 sáng fuel 100; không sinh thêm/sát thương/nhặt/hao dầu/kết thúc), camera bay vòng, 3 s khởi động, `bench.json` đúng định nghĩa `avg_fps`, `p1_low_fps`, `frame_ms_p95`.
- **Soak** (`scripts/soak.mjs`, `src/core/soak.js`): 10 Đêm xoay vòng, seed 7+i, input ngẫu nhiên theo seed, `soak.json`.
- **Bảng xếp hạng** (`src/core/leaderboard.js`, `server.js`): top 10, lưu `data/leaderboard.json`, màn hình từ menu, nhập tên sau Bình Minh hoặc khi thua, `--export-leaderboard`.
- **Dễ tiếp cận:** đổi 9 phím + báo trùng + khôi phục mặc định (lưu), phụ đề + mũi tên mép màn hình, giảm chuyển động, chữ ≥ 18 px, chữ lớn ×1.25.
- Render dùng `InstancedMesh` cho Bóng Mực và đom đóm (200 Bóng Mực + 100 đom đóm ở hàng trăm FPS).
- `scripts/e2e.mjs`: 19 kiểm tra trình duyệt (phím, phụ đề, flash, cỡ chữ, bảng xếp hạng trên đĩa).

### Thay đổi có thể nhận thấy (không phải luật)
| Thay đổi | Lý do |
|---|---|
| `contract_version` 1.2 → 1.3, `run_cmd` `npm start` → `node server.js` | Ticket-04; test `contract` sửa kèm nhãn `[Ticket-04]` |
| Cỡ chữ UI tăng lên ≥ 18 px, nút Lướt/Tỏa sáng rộng hơn | Yêu cầu accessibility |
| Phím tạm dừng đọc từ cài đặt (mặc định Esc); phím `P`/`Q` cũ không còn mặc định | Đổi phím; mặc định theo README |
| `soak_cmd` có cờ `--jitless --max-semi-space-size=1` | Giữ RSS ổn định, xem README mục Soak |

Luật, số liệu, bản đồ, đầu ra headless **không đổi**.

## Phase 3 — Ticket-03 "Đèn cạn dầu" (Contract v1.2)

Quyết định thiết kế: [docs/adr/0001-lantern-fuel-and-dawn-win.md](docs/adr/0001-lantern-fuel-and-dawn-win.md).

### ⚠ Breaking changes
| # | Thay đổi | Trước | Sau |
|---|---|---|---|
| B1 | `contract_version` | `1.1` | `1.2` |
| B2 | Thời lượng Đêm 1/2/3 | 300/330/360 s | **240/270/300 s** |
| B3 | Luật thắng | Thắng ngay khi thắp hết đèn | Còn sống lúc bình minh **và** đèn đang sáng ≥ ceil(0.6 × tổng). Không còn thắng sớm |
| B4 | Lý do kết thúc | thắng: `null` · thua: `no_flames`, `dawn` | thắng: **`dawn_survived`** · thua: `no_flames`, `dawn`. Thêm sự kiện **`game_over {reason, result}`** |
| B5 | Đèn đã sáng | Sáng vĩnh viễn, không nhận thêm đom đóm | Có dầu (100, −1/s), châm dầu được, hết dầu thì tắt (`lantern_out`), thắp lại cần 5 |
| B6 | Vùng an toàn | Mọi đèn sáng | Chỉ đèn có dầu ≥ 30 |
| B7 | Bóng Mực | 5 trạng thái, wander ngẫu nhiên | Thêm **`drain`**; wander nhắm đèn yếu (< 30) rồi đèn tắt gần nhất |
| B8 | Điểm | +10/đom đóm nạp, +100/đèn, +5/trúng, thưởng giây còn lại ×2, +50/lửa | +5/đom đóm nạp, +100 thắp lần đầu, +40 thắp lại, +5/trúng (+15 nếu đang drain), bình minh: +50 + floor(dầu) mỗi đèn sáng, +50/lửa. **Bỏ thưởng thời gian** (`per_second_left = 0`). Bộ khóa `tuning.score` giữ nguyên; +40/+15/+50 là hằng có tên trong `sim.js` |
| B9 | Sức chứa | Cố định 10 | 10 + 2 × số lần thắp thành công trong Đêm, tối đa 20 |

### Thêm (không phá tương thích)
- `tuning`: `fuel_max, fuel_decay_per_s, fuel_per_mote, relight_cost, win_ratio, drain_per_s, low_fuel_threshold, capacity_max`.
- Snapshot: đèn `fuel, ever_lit, relit_count, deposited`; player `capacity, successful_lights`; shade `target_lantern_id`.
- Scenario: đèn `lit, fuel, ever_lit`; player `successful_lights`; shade `target_lantern_id`.
- Sự kiện: `refuel`, `lantern_out`, `fuel_drain` (mỗi 60 tick hút của từng bóng), `lantern_lit.relight`.
- Giao diện: thanh dầu, nhấp nháy 1 Hz khi dầu < 30, đèn tắt xẹp 20 % + vết rách, HUD "mang/sức chứa" và mục tiêu bình minh, cài đặt "Bảng màu dễ phân biệt", nhạc nền tự sáng tác mới "Đêm Đèn Lồng".
- Giữ tương thích: đầu ra headless vẫn có mọi trường Phase 1–2 (`charge` song song `deposited`, `win`/`lose` song song `game_over`, `lose_reason` vẫn `null` khi thắng).

### Test cũ bị luật mới làm sai (đã sửa, không skip, lý do ghi ngay trong test với nhãn `[Ticket-03]`)
| Test | Lý do | Xử lý |
|---|---|---|
| `contract 1.1: standard tuning values` | B1, B2, B8 | Sửa thành `contract 1.2` |
| `interact … lights at 10` | B8: +5/đom đóm | Sửa điểm 200 → 150 |
| `lose no_flames; lose dawn` | B2 | 18000 → 14400 tick |
| `autopilot can win night 1` | B3 | Kỳ vọng `win` + `dawn_survived` (bot học châm dầu/thắp lại) |
| `CLI: scenario files …` | B1 | So với `CONTRACT.contract_version` |
| `pause …` | B2 | 300 → 240 s |
| `win/lose order: all lit on exact last tick ⇒ win` | B3, B8 | Giữ ý tưởng thứ tự tick, đổi kỳ vọng thành `dawn_survived` + điểm mới |
| `night chain data` | B2 | 330/360 → 270/300 |
| `performance: 21,600 ticks` | B2: Đêm dài nhất còn 18.000 tick | Chạy Đêm 3 tới bình minh + một lượt 21.600 tick có 3.600 tick tạm dừng |
| `shade states` | B7 | Thêm `drain` vào danh sách hợp lệ |
| regression `phase 1 win_bot` | B3 | `win` lúc bình minh, `lanterns_lit ≥ 3` |
| regression `phase 1 idle_lose` | B7: Bóng Mực đi về phía đèn, không còn chắc bắt được Mây đứng yên | Vẫn thua: `no_flames` **hoặc** `dawn` với 0 đèn sáng |

Không có test nào bị xóa hay skip.

## Phase 2 — Ticket-02 (Contract v1.1)
Xem [docs/notes/phase2-spec.md](docs/notes/phase2-spec.md) mục 3 (test bị thay) và mục 8 (lỗi hồi quy Phase 1 đã sửa).

## Phase 1 — PRD-0 (Contract v1.0)
Bản đầu: Đêm 1, headless, 15 test.
