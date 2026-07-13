export type ItemQuantity = {
  code: string;
  quantity: number;
};

export function ItemQuantitySummary({ items }: { items: ItemQuantity[] }) {
  return <div className="item-quantity-summary">
    {items.map((item, index) => <span key={`${item.code}-${index}`}><strong>{item.code}</strong><b>{item.quantity}개</b></span>)}
  </div>;
}
