import {
  Flex,
  FlexItem,
  Icon,
} from '@patternfly/react-core';
import {
  PlusCircleIcon,
  SyncAltIcon,
  SearchIcon,
} from '@patternfly/react-icons';
import type { CollectionRun } from '../api/client';

interface ResourceStatsProps {
  run: CollectionRun;
  compact?: boolean;
}

export function ResourceStats({ run, compact = false }: ResourceStatsProps) {
  if (compact) {
    return (
      <span>
        {run.resources_found} found · {run.resources_created} new · {run.resources_updated} updated
      </span>
    );
  }

  return (
    <Flex spaceItems={{ default: 'spaceItemsLg' }}>
      <FlexItem>
        <Icon size="sm"><SearchIcon /></Icon>{' '}
        <strong>{run.resources_found}</strong> found
      </FlexItem>
      <FlexItem>
        <Icon size="sm"><PlusCircleIcon /></Icon>{' '}
        <strong>{run.resources_created}</strong> created
      </FlexItem>
      <FlexItem>
        <Icon size="sm"><SyncAltIcon /></Icon>{' '}
        <strong>{run.resources_updated}</strong> updated
      </FlexItem>
    </Flex>
  );
}
