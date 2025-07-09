import { IconButton } from '../common/IconButton';
import type { LibraryPreset } from '../../utils/libraryUtils';

interface LibraryTableContentProps {
  presets: LibraryPreset[];
  selectedPresets: Set<string>;
  onToggleSelection: (presetId: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onToggleFavorite: (preset: LibraryPreset) => void;
  onLoadPreset: (preset: LibraryPreset) => void;
  onDownloadPreset: (preset: LibraryPreset) => void;
  onDeletePreset: (preset: LibraryPreset) => void;
  sortBy: 'name' | 'date' | 'type';
  sortOrder: 'asc' | 'desc';
  onSort: (column: 'name' | 'date' | 'type') => void;
  isMobile: boolean;
  formatDate: (timestamp: number) => string;
}

export function LibraryTableContent({
  presets,
  selectedPresets,
  onToggleSelection,
  onSelectAll,
  onClearSelection,
  onToggleFavorite,
  onLoadPreset,
  onDownloadPreset,
  onDeletePreset,
  sortBy,
  sortOrder,
  onSort,
  isMobile,
  formatDate
}: LibraryTableContentProps) {
  if (isMobile) {
    return (
      <>
        {presets.map((preset, index) => (
          <div key={preset.id} style={{
            background: 'var(--color-bg-primary)',
            border: '1px solid var(--color-border-light)',
            borderTop: index === 0 ? '1px solid var(--color-border-light)' : 'none',
            borderBottom: '1px solid var(--color-border-light)',
            borderRadius: 0,
            boxShadow: 'none',
            marginBottom: 0,
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}>
            {/* Header with name, type, and favorite */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ 
                  fontWeight: 600, 
                  fontSize: '1.1rem', 
                  color: 'var(--color-text-primary)',
                  marginBottom: '0.25rem'
                }}>
                  {preset.name}
                </div>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.5rem',
                  color: 'var(--color-text-secondary)', 
                  fontSize: '0.9rem' 
                }}>
                  <i className={`fas fa-${preset.type === 'drum' ? 'drum' : 'keyboard'}`}></i>
                  {preset.type}
                </div>
              </div>
              <IconButton
                icon={preset.isFavorite ? 'fas fa-star' : 'far fa-star'}
                onClick={() => onToggleFavorite(preset)}
                title={preset.isFavorite ? 'remove from favorites' : 'add to favorites'}
                color={preset.isFavorite ? 'var(--color-text-primary)' : 'var(--color-text-secondary)'}
              />
            </div>

            {/* Description */}
            {preset.description && (
              <div style={{ 
                color: 'var(--color-text-secondary)', 
                fontSize: '0.85rem',
                lineHeight: '1.4'
              }}>
                {preset.description}
              </div>
            )}

            {/* Metadata row */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              fontSize: '0.8rem',
              color: 'var(--color-text-secondary)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <i className="fas fa-music"></i>
                {preset.sampleCount !== undefined ? `${preset.sampleCount} samples` : 'no samples'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <i className="fas fa-clock"></i>
                {formatDate(preset.updatedAt)}
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ 
              display: 'flex', 
              gap: '0.5rem', 
              marginTop: '0.5rem'
            }}>
              <button 
                onClick={() => onLoadPreset(preset)} 
                style={{ 
                  fontSize: '0.9rem', 
                  padding: '0.75rem 1rem', 
                  borderRadius: '6px', 
                  border: 'none', 
                  background: 'var(--color-interactive-focus)', 
                  color: 'var(--color-white)', 
                  cursor: 'pointer',
                  flex: 1,
                  fontWeight: '500'
                }}
              >
                load
              </button>
              <button 
                onClick={() => onDownloadPreset(preset)} 
                style={{ 
                  fontSize: '0.9rem', 
                  padding: '0.75rem 1rem', 
                  borderRadius: '6px', 
                  border: '1px solid var(--color-border-light)', 
                  background: 'var(--color-bg-secondary)', 
                  color: 'var(--color-text-primary)', 
                  cursor: 'pointer',
                  flex: 1
                }}
              >
                download
              </button>
              <IconButton
                icon="fas fa-trash"
                onClick={() => onDeletePreset(preset)}
                title="delete preset"
                color="var(--color-text-secondary)"
              />
            </div>
          </div>
        ))}
      </>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        backgroundColor: 'var(--color-bg-primary)',
        borderBottom: '1px solid #000'
      }}>
        <thead>
          <tr style={{
            backgroundColor: 'var(--color-bg-secondary)',
            borderBottom: '1px solid var(--color-border-light)'
          }}>
            <th style={{
              padding: '0.75rem',
              textAlign: 'left',
              fontSize: '0.85rem',
              fontWeight: '500',
              color: 'var(--color-text-primary)',
            }} scope="col">
              <input
                type="checkbox"
                checked={presets.length > 0 && presets.every(preset => selectedPresets.has(preset.id))}
                onChange={e => e.target.checked ? onSelectAll() : onClearSelection()}
                style={{
                  margin: 0,
                  width: '16px',
                  height: '16px',
                  accentColor: 'var(--color-text-secondary)',
                  cursor: 'pointer',
                }}
              />
            </th>
            <th 
              style={{
                padding: '0.75rem',
                textAlign: 'left',
                fontSize: '0.85rem',
                fontWeight: '500',
                color: 'var(--color-text-primary)',
                cursor: 'pointer'
              }}
              onClick={() => onSort('name')}
              scope="col"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>name</span>
                {sortBy === 'name' ? (
                  <i className={`fas fa-sort-${sortOrder === 'asc' ? 'up' : 'down'}`}></i>
                ) : (
                  <i className="fas fa-sort" style={{ color: 'var(--color-text-secondary)', opacity: 0.5 }}></i>
                )}
              </div>
            </th>
            <th 
              style={{
                padding: '0.75rem',
                textAlign: 'center',
                fontSize: '0.85rem',
                fontWeight: '500',
                color: 'var(--color-text-primary)',
              }}
              onClick={() => onSort('type')}
              scope="col"
            >
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
                <span>type</span>
                {sortBy === 'type' ? (
                  <i className={`fas fa-sort-${sortOrder === 'asc' ? 'up' : 'down'}`}></i>
                ) : (
                  <i className="fas fa-sort" style={{ color: 'var(--color-text-secondary)', opacity: 0.5 }}></i>
                )}
              </div>
            </th>
            <th style={{
              padding: '0.75rem',
              textAlign: 'center',
              fontSize: '0.85rem',
              fontWeight: '500',
              color: 'var(--color-text-primary)',
            }} scope="col">
              samples
            </th>
            <th 
              style={{
                padding: '0.75rem',
                textAlign: 'left',
                fontSize: '0.85rem',
                fontWeight: '500',
                color: 'var(--color-text-primary)',
                cursor: 'pointer'
              }}
              onClick={() => onSort('date')}
              scope="col"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>updated</span>
                {sortBy === 'date' ? (
                  <i className={`fas fa-sort-${sortOrder === 'asc' ? 'up' : 'down'}`}></i>
                ) : (
                  <i className="fas fa-sort" style={{ color: 'var(--color-text-secondary)', opacity: 0.5 }}></i>
                )}
              </div>
            </th>
            <th style={{
              padding: '0.75rem',
              textAlign: 'center',
              fontSize: '0.85rem',
              fontWeight: '500',
              color: 'var(--color-text-primary)'
            }} scope="col">
              actions
            </th>
          </tr>
        </thead>
        <tbody>
          {presets.map((preset) => (
            <tr
              key={preset.id}
              style={{
                backgroundColor: selectedPresets.has(preset.id) 
                  ? 'var(--color-bg-secondary)' 
                  : 'var(--color-bg-primary)',
                borderBottom: '1px solid var(--color-border-light)',
                transition: 'all 0.2s ease'
              }}
            >
              <td style={{
                padding: '0.75rem',
                verticalAlign: 'top'
              }}>
                <input
                  type="checkbox"
                  checked={selectedPresets.has(preset.id)}
                  onChange={() => onToggleSelection(preset.id)}
                  style={{
                    margin: 0,
                    width: '16px',
                    height: '16px',
                    accentColor: 'var(--color-text-secondary)',
                    cursor: 'pointer',
                  }}
                />
              </td>
              <td style={{
                padding: '0.75rem',
                verticalAlign: 'top'
              }}>
                <div style={{
                  fontSize: '0.9rem',
                  fontWeight: 400,
                  color: 'var(--color-text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontFamily: 'Montserrat, Arial, sans-serif'
                }}>
                  {preset.name}
                </div>
              </td>
              <td style={{
                padding: '0.75rem',
                verticalAlign: 'top',
                textAlign: 'center'
              }}>
                <i 
                  className={`fas fa-${preset.type === 'drum' ? 'drum' : 'keyboard'}`}
                  style={{
                    fontSize: '1.2rem',
                    color: 'var(--color-text-secondary)'
                  }}
                  title={preset.type}
                ></i>
              </td>
              <td style={{
                padding: '0.75rem',
                verticalAlign: 'top',
                fontSize: '0.85rem',
                color: 'var(--color-text-secondary)',
                textAlign: 'center'
              }}>
                {preset.sampleCount !== undefined ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                    <i className="fas fa-music"></i>
                    {preset.sampleCount}
                  </div>
                ) : '-'}
              </td>
              <td style={{
                padding: '0.75rem',
                verticalAlign: 'top',
                fontSize: '0.85rem',
                color: 'var(--color-text-secondary)'
              }}>
                {formatDate(preset.updatedAt)}
              </td>
              <td style={{
                padding: '0.75rem',
                verticalAlign: 'top'
              }}>
                <div style={{
                  display: 'flex',
                  gap: '0.5rem',
                  justifyContent: 'center'
                }}>
                  <IconButton
                    icon={preset.isFavorite ? 'fas fa-star' : 'far fa-star'}
                    onClick={() => onToggleFavorite(preset)}
                    title={preset.isFavorite ? 'remove from favorites' : 'add to favorites'}
                    color={preset.isFavorite ? 'var(--color-text-primary)' : 'var(--color-text-secondary)'}
                  />
                  <IconButton
                    icon="fas fa-folder-open"
                    onClick={() => onLoadPreset(preset)}
                    title="load preset"
                    color="var(--color-interactive-focus)"
                  />
                  <IconButton
                    icon="fas fa-download"
                    onClick={() => onDownloadPreset(preset)}
                    title="download preset"
                    color="var(--color-text-secondary)"
                  />
                  <IconButton
                    icon="fas fa-trash"
                    onClick={() => onDeletePreset(preset)}
                    title="delete preset"
                    color="var(--color-text-secondary)"
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
} 