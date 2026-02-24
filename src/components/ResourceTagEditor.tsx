import { useState, useRef, useEffect } from 'react';
import {
  Button,
  Label,
  LabelGroup,
  Modal,
  ModalVariant,
  TextInput,
  ActionList,
  ActionListItem,
  Spinner,
  Divider,
} from '@patternfly/react-core';
import { PlusIcon } from '@patternfly/react-icons';
import { api } from '../api/client';
import type { Tag } from '../api/client';

interface Props {
  resourceId: string;
  resourceName: string;
  initialTags: Tag[];
  isOpen: boolean;
  onClose: () => void;
  onChange?: (tags: Tag[]) => void;
}

export function ResourceTagEditor({ resourceId, resourceName, initialTags, isOpen, onClose, onChange }: Props) {
  const [tags, setTags] = useState<Tag[]>(initialTags);
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<Tag[]>([]);
  const [sugLoading, setSugLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setTags(initialTags); }, [initialTags]);

  const searchTags = (q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSugLoading(true);
      try {
        const res = await api.listTags('key=' + encodeURIComponent(q) + '&page_size=10');
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
      setTags(updated); onChange?.(updated);
    } finally { setSaving(false); setInputValue(''); setSuggestions([]); }
  };

  const createAndAddTag = async () => {
    const raw = inputValue.trim();
    if (!raw) return;
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
      setTags(updated); onChange?.(updated);
    } finally { setSaving(false); setInputValue(''); setSuggestions([]); }
  };

  const removeTag = async (tagId: string) => {
    setSaving(true);
    try {
      const updated = await api.removeResourceTags(resourceId, [tagId]);
      setTags(updated); onChange?.(updated);
    } finally { setSaving(false); }
  };

  const tagLabel = (t: Tag) => t.value ? t.key + '=' + t.value : t.key;

  const tagColor = (t: Tag): React.ComponentProps<typeof Label>['color'] => {
    if (t.namespace === 'type' && t.key === 'category') return 'blue';
    if (t.namespace === 'type' && t.key === 'resource_type') return 'cyan';
    if (t.namespace === 'type' && t.key === 'infrastructure') return 'purple';
    return 'grey';
  };

  return (
    <Modal variant={ModalVariant.small} title={'Tags \u2014 ' + resourceName} isOpen={isOpen} onClose={onClose}
      actions={[<Button key='done' variant='primary' onClick={onClose}>Done</Button>]}>
      <div style={{ marginBottom: '1rem' }}>
        <p style={{ fontSize: '0.85rem', color: 'var(--pf-v5-global--Color--200)', marginBottom: '0.75rem' }}>
          System tags (blue/cyan/purple) are auto-applied by collection runs and cannot be removed.
          Grey tags are user-defined.
        </p>
        <LabelGroup numLabels={20} isCompact>
          {tags.length === 0 && <span style={{ fontSize: '0.85rem', color: 'var(--pf-v5-global--Color--200)' }}>No tags yet.</span>}
          {tags.map((t) => (
            <Label key={t.id} isCompact color={tagColor(t)}
              onClose={saving || t.namespace === 'type' ? undefined : () => removeTag(t.id)}
              closeBtnAriaLabel={'Remove ' + tagLabel(t)}>
              {tagLabel(t)}
            </Label>
          ))}
        </LabelGroup>
      </div>
      <Divider style={{ marginBottom: '1rem' }} />
      <div>
        <p style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem' }}>Add tag</p>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <TextInput autoFocus value={inputValue} placeholder='key=value or namespace/key=value'
            onChange={(_e, v) => { setInputValue(v); searchTags(v); }}
            onKeyDown={(e) => { if (e.key === 'Enter') createAndAddTag(); }}
            aria-label='New tag' style={{ flex: 1 }} />
          <Button variant='primary' isSmall isDisabled={!inputValue.trim() || saving} isLoading={saving} onClick={createAndAddTag}>
            <PlusIcon /> Add
          </Button>
        </div>
        <p style={{ fontSize: '0.75rem', color: 'var(--pf-v5-global--Color--200)', marginTop: '0.35rem' }}>
          Examples: <code>env=prod</code>, <code>cost_center=eng</code>, <code>app/tier=frontend</code>
        </p>
        {(sugLoading || suggestions.length > 0) && (
          <div style={{ marginTop: '0.5rem', border: '1px solid var(--pf-v5-global--BorderColor--100)', borderRadius: '3px', maxHeight: '160px', overflowY: 'auto' }}>
            {sugLoading && <div style={{ padding: '0.5rem' }}><Spinner size='sm' /></div>}
            <ActionList>
              {suggestions.map(t => (
                <ActionListItem key={t.id}>
                  <Button variant='plain' isDisabled={saving}
                    style={{ width: '100%', textAlign: 'left', padding: '0.3rem 0.6rem' }}
                    onClick={() => addTag(t)}>
                    <Label isCompact color={tagColor(t)}>{tagLabel(t)}</Label>
                    <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: 'var(--pf-v5-global--Color--200)' }}>{t.namespace}</span>
                  </Button>
                </ActionListItem>
              ))}
            </ActionList>
          </div>
        )}
      </div>
    </Modal>
  );
}
