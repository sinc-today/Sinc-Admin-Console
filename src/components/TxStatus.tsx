import { StatusBadge } from './ui';

export function TxStatus({ status }: { status: string }) {
  if (status === 'SUCCESS') return <StatusBadge status="ok">Successful</StatusBadge>;
  if (status === 'FAILED') return <StatusBadge status="critical">Failed</StatusBadge>;
  return <StatusBadge status="pending">Pending</StatusBadge>;
}
