# ADR 0001 — Đèn có dầu, Bóng Mực hút dầu, thắng khi giữ đảo sáng tới bình minh

- **Trạng thái:** Chấp nhận (Phase 3, Ticket-03, Contract v1.2)
- **Bối cảnh:** Playtest: người chơi giỏi thắp hết đèn trong ~2 phút rồi Đêm kết thúc, cuối Đêm thiếu căng thẳng. Khách đổi mục tiêu từ "thắp hết" sang "giữ đảo sáng tới bình minh".

## Quyết định

### 1. Mô hình trạng thái đèn
Trước (Ticket-02): `chưa thắp (charge < 10) → sáng (vĩnh viễn)`.

Sau:

```
            nạp đủ 10                 dầu < 30               dầu ≤ 0
 CHƯA THẮP ───────────▶ SÁNG (vùng an toàn) ─────▶ YẾU (mất vùng an toàn, ─────▶ TẮT (ever_lit = true,
 (ever_lit=false)        dầu = 100, −1/s           Bóng Mực wander tới hút)       deposited = 0)
                              ▲     châm dầu ≥ 30 ◀──┘                               │
                              └──────────────── nạp đủ 5 (thắp lại, +40) ◀───────────┘
```

- Dầu lưu bằng **số nguyên đơn vị 1/60** (`fuelUnits`, tối đa 6000). Hao 1/s = 1 đơn vị/tick, Bóng Mực hút 5/s = 5 đơn vị/tick. Không có sai số số thực, kết quả headless tất định trên mọi máy. Chỉ làm tròn (1 chữ số thập phân) khi xuất snapshot.
- Hao dầu và hút dầu nằm ở **bước 2** của tick; đèn hết dầu tắt **ngay sau bước 2**, trước khi Mây di chuyển. Bóng đang hút trong tick trước mới được tính hút trong tick này.
- Tương tác chọn trong các đèn *nhận được*: chưa sáng, hoặc sáng nhưng chưa đầy dầu. Đèn đầy không được chọn.
- Thắp (lần đầu hoặc thắp lại) và châm dầu vượt từ < 30 lên ≥ 30 đều dùng chung cơ chế "đẩy Bóng Mực ra mép 6 m trong ≤ 30 tick, không gây sát thương" có từ Ticket-02.

### 2. Bóng Mực: thêm trạng thái `drain`
`wander` giờ **có mục tiêu**: đèn sáng có dầu < 30 gần nhất, không có thì đèn tắt gần nhất; tới nơi thì lượn ngẫu nhiên. Đây là thay đổi so với giả định A2 của Phase 2 (wander ngẫu nhiên hoàn toàn), vì ticket ghi "đi về đèn tắt gần nhất như trước". Cách ≤ 2 m đèn yếu thì chuyển `drain`. Rời `drain` khi Mây vào trong 6 m (→ chase), trúng Tỏa Sáng (→ stunned), hoặc đèn tắt / dầu ≥ 30 / cách > 2 m (→ wander).

### 3. Luật thắng
Bỏ "thắng ngay khi tất cả đèn sáng". Bước 11 (xét thắng/thua) chạy sau mọi cập nhật của tick, theo thứ tự: hết Ngọn Lửa → `no_flames` (luôn trước); hết giờ → `dawn_survived` nếu số đèn đang sáng ≥ `ceil(win_ratio × tổng)`, ngược lại `dawn`. Thời gian Đêm: 240/270/300 s.

### 4. Sức chứa và điểm
Sức chứa = `min(capacity_max, carry_capacity + 2 × successful_lights)`. Điểm: +5 mỗi đom đóm nạp, +100 thắp lần đầu, +40 thắp lại, +5 mỗi Bóng Mực trúng Tỏa Sáng (+15 nếu đang drain), khi thắng: mỗi đèn sáng +50 + floor(dầu), mỗi Ngọn Lửa +50. Bỏ thưởng thời gian.

## Phương án đã cân nhắc
- **Dầu số thực (float):** đơn giản hơn nhưng cộng dồn 1/60 qua 18.000 tick gây sai số, có thể lệch "đúng 30" và lệch tick tắt đèn giữa các máy. Loại.
- **Hao dầu ở bước 5/8 (sau tương tác/di chuyển):** không đúng thứ tự ticket yêu cầu. Loại.
- **Giữ thắng sớm làm tùy chọn:** ticket cấm ("Thắp đủ đèn không kết thúc Đêm"). Loại.

## Hệ quả
- Phá tương thích: lý do kết thúc, thời lượng Đêm, công thức điểm, test "thắng khi thắp hết" (xem `CHANGELOG.md`).
- Các test Phase 1–2 bị luật này thay được **sửa kèm lý do** (bảng trong `CHANGELOG.md`), không skip.
- Bot phải biết châm dầu để sống tới bình minh.
- Headless giữ tập cha: đầu ra vẫn có các trường Phase 1–2; thêm `game_over {reason}`, `deposited` song song `charge`.
