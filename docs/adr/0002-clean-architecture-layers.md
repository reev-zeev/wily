# ADR-0002: نمط Clean Architecture مع Modular Monolith

## الحالة
مقبول

## السياق
نحتاج بنية تدعم نمو المنصة مع الحفاظ على فصل واضح بين الاهتمامات.

## القرار
استخدام Clean Architecture مع Modular Monolith:
- `domain/` — منطق أعمال خالص
- `application/` — حالات الاستخدام
- `infrastructure/` — تكاملات خارجية

**القاعدة الذهبية**: `domain` لا يستورد من `infrastructure` إطلاقاً.

## RPC Naming Convention
فعل_اسم بصيغة snake_case:
- `claim_ride`
- `renew_subscription`
- `record_attendance`

## Result Pattern
```typescript
export async function verbNoun(
  input: XInput,
  deps: XDeps
): Promise<Result<T, XError>>
```

لا `throw` لأخطاء العمل المتوقعة — استخدم `Result<T,E>`.
