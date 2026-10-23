export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatWhen(value) {
  if (!value) return 'No expiry';
  return new Date(value).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDay(value) {
  if (!value) return 'No expiry';
  return new Date(value).toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function fileKind(name = '') {
  const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
  if (ext === 'jpeg') return 'JPG';
  if (['pdf', 'doc', 'docx', 'txt', 'png', 'jpg'].includes(ext)) return ext.toUpperCase();
  return 'FILE';
}

export function roleLabel(role) {
  if (!role) return '';
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export function initials(name = '') {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part.charAt(0).toUpperCase()).join('') || '?';
}

export function describeEvent(event) {
  const meta = event.meta || {};
  const title = meta.title || event.document?.title || 'a document';
  switch (event.action) {
    case 'login':
      return 'Signed in';
    case 'upload':
      return `Uploaded ${title}`;
    case 'view':
      return `Opened ${title}`;
    case 'download':
      return `Downloaded ${title}`;
    case 'share':
      return `Shared ${title} with ${meta.name || 'a member'}${meta.canDownload ? ', including download' : ', view only'}`;
    case 'revoke':
      return `Revoked access for ${meta.name || 'a member'} on ${title}`;
    case 'delete':
      return `Deleted ${title}`;
    case 'role_change':
      if (meta.event === 'added') return `Added ${meta.name} as ${meta.role}`;
      if (meta.event === 'deactivated') return `Deactivated ${meta.name}`;
      if (meta.event === 'reactivated') return `Reactivated ${meta.name}`;
      if (meta.from && meta.to) return `Changed ${meta.name} from ${meta.from} to ${meta.to}`;
      return `Updated ${meta.name || 'a member'}`;
    default:
      return event.action;
  }
}

export function todayInputValue() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}
