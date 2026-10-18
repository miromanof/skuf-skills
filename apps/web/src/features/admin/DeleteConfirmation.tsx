import { useState } from 'react';

export function DeleteConfirmation({ onConfirm, disabled }: { onConfirm: () => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  if (!open) return <button className="button admin-danger" type="button" disabled={disabled} onClick={() => setOpen(true)}>Удалить карточку</button>;
  return <div className="delete-confirm" role="alert"><strong>Удалить без возможности восстановления?</strong><div><button className="button admin-danger" type="button" onClick={onConfirm}>Да, удалить</button><button className="button" type="button" onClick={() => setOpen(false)}>Отмена</button></div></div>;
}
