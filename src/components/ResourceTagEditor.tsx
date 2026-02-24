import { useState, useRef, useEffect } from 'react';
import {
  Button,
  Label,
  LabelGroup,
  Popover,
  TextInput,
  ActionList,
  ActionListItem,
  Spinner,
} from '@patternfly/react-core';
import { PlusIcon, TimesIcon } from '@patternfly/react-icons';
import { api } from '../api/client';
import type { Tag } from '../api/client';

interface Props {
  resourceId: string;
  initialTags: Tag[];
  onChange?: (tags: Tag[]) => void;
}

export function ResourceTagEditor({ resourceId, initialTags, onChange }: Props) {
  const [tags, setTags] = useState<Tag[]>(initialTags);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<Tag[]>([]);
  const [sugLoading, setSugLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep in sync with parent if initialTags changes (e.g. after resource reload)
  useEffect(() => { setTags(initialTags); }, [initialTags]);

  const searchTags = (q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSugLoading(true);
      try {
        const res = await api.listTags('key=' + encodeURIComponent(q) + '&page_size=10');
        // Filter out already-applied tags
        const appliedIds = new Set(tags.map(t => t.id));
        setSuggestions(res.results.filter(t => !appliedIds.has(t.id)));
      } catch { setSuggestions([]); }
      finally { setSugLoading(false); }
    }, 250);
  };

  const addTag = async (tag: Tag) => {
    setSaving(true);
    try {
      const updated = await api.addResourceTags(resourceId, [tag]);
      setTags(updated);
      onChange?.(updated);
    } finally {
      setSaving(false);
      setInputValue('');
      setSuggestions([]);
    }
  };

  const createAndAddTag = async () => {
    const raw = inputValue.trim();
    if (!raw) return;
    // Support "namespace/key=value", "key=value", or plain "value" syntax
    let namespace = 'user', key = 'label', value = raw;
    if (raw.includes('/')) {
      const [ns, rest] = raw.split('/', 2);
      namespace = ns;
      if (rest.includes('=')) { const [k, v] = rest.split('=', 2); key = k; value = v; }
      else { key = rest; value = ''; }
    } else if (raw.includes('=')) {
      const [k, v] = raw.split('=', 2); key = k; value = v;
    }
    setSaving(true);
    try {
      const updated = await api.addResourceTags(resourceId, [{ namespace, key, value }]);
      setTags(updated);
      onChange?.(updated);
    } finally {
      setSaving(false);
      setInputValue('');
      setSuggestions([]);
    }
  };

  const removeTag = async (tagId: string) => {
    setSaving(true);
    try {
      const updated = await api.removeResourceTags(resourceId, [tagId]);
      setTags(updated);
      onChange?.(updated);
    } finally { setSaving(false); }
  };

  const tagLabel = (t: Tag) => {
    if (t.namespace === 'type') return t.value;
    if (t.value) return `${t.key}=${t.value}`;
    return t.key;
  };

  const tagColor = (t: Tag): React.ComponentProps<typeof Label>['color'] => {
    if (t.namespace === 'type' && t.key === 'category') return 'blue';
    if (t.namespace === 'type' && t.key === 'resource_type') return 'cyan';
    return 'grey';
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
      <LabelGroup numLabels={10} isCompact>
        {tags.map((t) => (
          <Label
            key={t.id}
            isCompact
            color={tagColor(t)}
            onClose={saving ? undefined : () => removeTag(t.id)}
            closeBtnAriaLabel={`Remove tag ${tagLabel(t)}`}
          >
            {tagLabel(t)}
          </Label>
        ))}
      </LabelGroup>

      <Popover
        isVisible={popoverOpen}
        shouldClose={() => setPopoverOpen(false)}
        bodyContent={
          <div style={{ minWidth: '220px' }}>
            <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.5rem' }}>
              <TextInput
                autoFocus
                value={inputValue}
                placeholder="Search or type new tag…"
                onChange={(_e, v) => { setInputValue(v); searchTags(v); }}
                onKeyDown={(e) => { if (e.key === 'Enter') createAndAddTag(); }}
                aria-label="Tag input"
                style={{ flex: 1 }}
              />
              {saving && <Spinner size="sm" />}
            </div>
            {inputValue.trim() && (
              <Button variant="link" isInline style={{ marginBottom: '0.4rem' }}
                onClick={createAndAddTag} isDisabled={saving}>
                <PlusIcon /> Create &ldquo;{inputValue.trim()}&rdquo;
              </Button>
            )}
            {sugLoading && <Spinner size="sm" />}
            {suggestions.length > 0 && (
              <ActionList style={{ maxHeight: '180px', overflowY: 'auto' }}>
                {suggestions.map(t => (
                  <ActionListItem key={t.id}>
                    <Button variant="plain" isDisabled={saving}
                      style={{ width: '100%', textAlign: 'left', padding: '0.2rem 0.4rem' }}
                      onClick={() => addTag(t)}>
                      <Label isCompact color={tagColor(t)}>{tagLabel(t)}</Label>
                    </Button>
                  </ActionListItem>
                ))}
              </ActionList>
            )}
            <p style={{ fontSize: '0.75rem', color: 'var(--pf-v5-global--Color--200)', marginTop: '0.5rem' }}>
              Tip: type <code>namespace/key=value</code> or plain text
            </p>
          </div>
        }
      >
        <Button variant="plain" isSmall aria-label="Add tag" onClick={() => setPopoverOpen(v => !v)}>
          <PlusIcon />
        </Button>
      </Popover>
    </div>
  );
}
