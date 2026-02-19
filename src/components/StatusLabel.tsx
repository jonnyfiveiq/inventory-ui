import {
  Label,
  Spinner,
} from '@patternfly/react-core';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
  BanIcon,
  ClockIcon,
} from '@patternfly/react-icons';
import type { CollectionStatus } from '../api/client';

const statusConfig: Record<
  CollectionStatus,
  { color: 'blue' | 'green' | 'red' | 'orange' | 'grey'; icon: React.ReactElement; text: string }
> = {
  pending: {
    color: 'blue',
    icon: <ClockIcon />,
    text: 'Pending',
  },
  running: {
    color: 'blue',
    icon: <Spinner size="sm" />,
    text: 'Running',
  },
  completed: {
    color: 'green',
    icon: <CheckCircleIcon />,
    text: 'Completed',
  },
  failed: {
    color: 'red',
    icon: <ExclamationCircleIcon />,
    text: 'Failed',
  },
  canceled: {
    color: 'orange',
    icon: <BanIcon />,
    text: 'Canceled',
  },
};

interface StatusLabelProps {
  status: CollectionStatus;
}

export function StatusLabel({ status }: StatusLabelProps) {
  const config = statusConfig[status] ?? statusConfig.pending;
  return (
    <Label color={config.color} icon={config.icon}>
      {config.text}
    </Label>
  );
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return '—';
  if (seconds < 1) return `${Math.round(seconds * 1000)}ms`;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s`;
}

export function formatTimestamp(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
