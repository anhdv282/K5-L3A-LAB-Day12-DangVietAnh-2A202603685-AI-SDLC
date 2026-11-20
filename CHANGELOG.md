# Changelog

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
