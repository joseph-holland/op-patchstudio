interface LibraryFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  filterType: 'all' | 'drum' | 'multisample';
  onFilterTypeChange: (value: 'all' | 'drum' | 'multisample') => void;
  filterFavorites: boolean;
  onFilterFavoritesChange: (value: boolean) => void;
  selectedPresets: Set<string>;
  onBulkDelete: () => void;
  onClearSelection: () => void;
  isMobile: boolean;
}

export function LibraryFilters({
  searchTerm,
  onSearchChange,
  filterType,
  onFilterTypeChange,
  filterFavorites,
  onFilterFavoritesChange,
  selectedPresets,
  onBulkDelete,
  onClearSelection,
  isMobile
}: LibraryFiltersProps) {
  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {/* Search */}
        <div style={{ width: '100%' }}>
          <input
            type="text"
            placeholder="search presets..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid var(--color-border-light)',
              borderRadius: '6px',
              backgroundColor: 'var(--color-bg-primary)',
              color: 'var(--color-text-primary)',
              fontSize: '1rem'
            }}
          />
        </div>

        {/* Filters Row */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {/* Type Filter */}
          <select
            value={filterType}
            onChange={(e) => onFilterTypeChange(e.target.value as 'all' | 'drum' | 'multisample')}
            style={{
              padding: '0.75rem',
              border: '1px solid var(--color-border-light)',
              borderRadius: '6px',
              backgroundColor: 'var(--color-bg-primary)',
              color: 'var(--color-text-primary)',
              fontSize: '0.9rem',
              flex: 1
            }}
          >
            <option value="all">all types</option>
            <option value="drum">drum</option>
            <option value="multisample">multisample</option>
          </select>

          {/* Favorites Filter */}
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            cursor: 'pointer',
            fontSize: '0.9rem',
            color: 'var(--color-text-secondary)',
            padding: '0.75rem',
            border: '1px solid var(--color-border-light)',
            borderRadius: '6px',
            backgroundColor: 'var(--color-bg-primary)',
            whiteSpace: 'nowrap'
          }}>
            <input
              type="checkbox"
              checked={filterFavorites}
              onChange={(e) => onFilterFavoritesChange(e.target.checked)}
              style={{ margin: 0, width: '16px', height: '16px' }}
            />
            favorites
          </label>
        </div>

        {/* Bulk Actions */}
        {selectedPresets.size > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={onBulkDelete}
              style={{
                padding: '0.75rem 1rem',
                border: '1px solid var(--color-border-light)',
                borderRadius: '6px',
                backgroundColor: 'var(--color-bg-primary)',
                color: 'var(--color-text-primary)',
                cursor: 'pointer',
                fontSize: '0.9rem',
                flex: 1
              }}
            >
              delete selected ({selectedPresets.size})
            </button>
            <button
              onClick={onClearSelection}
              style={{
                padding: '0.75rem 1rem',
                border: '1px solid var(--color-border-light)',
                borderRadius: '6px',
                backgroundColor: 'var(--color-bg-secondary)',
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
            >
              clear
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
      {/* Search */}
      <div style={{ minWidth: '200px' }}>
        <input
          type="text"
          placeholder="search presets..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          style={{
            width: '100%',
            padding: '0.5rem',
            border: '1px solid var(--color-border-light)',
            borderRadius: '6px',
            backgroundColor: 'var(--color-bg-primary)',
            color: 'var(--color-text-primary)',
            fontSize: '0.9rem'
          }}
        />
      </div>

      {/* Type Filter */}
      <select
        value={filterType}
        onChange={(e) => onFilterTypeChange(e.target.value as 'all' | 'drum' | 'multisample')}
        style={{
          padding: '0.5rem',
          border: '1px solid var(--color-border-light)',
          borderRadius: '6px',
          backgroundColor: 'var(--color-bg-primary)',
          color: 'var(--color-text-primary)',
          fontSize: '0.9rem'
        }}
      >
        <option value="all">all types</option>
        <option value="drum">drum</option>
        <option value="multisample">multisample</option>
      </select>

      {/* Favorites Filter */}
      <label style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        cursor: 'pointer',
        fontSize: '0.9rem',
        color: 'var(--color-text-secondary)'
      }}>
        <input
          type="checkbox"
          checked={filterFavorites}
          onChange={(e) => onFilterFavoritesChange(e.target.checked)}
          style={{ margin: 0 }}
        />
        favorites
      </label>
      
      {/* Bulk Actions */}
      <button
        onClick={onBulkDelete}
        disabled={selectedPresets.size === 0}
        style={{
          padding: '0.5rem 1rem',
          border: '1px solid var(--color-border-light)',
          borderRadius: '6px',
          backgroundColor: 'var(--color-bg-primary)',
          color: selectedPresets.size === 0 ? 'var(--color-text-secondary)' : 'var(--color-text-primary)',
          cursor: selectedPresets.size === 0 ? 'not-allowed' : 'pointer',
          fontSize: '0.85rem',
          opacity: selectedPresets.size === 0 ? 0.5 : 1,
          transition: 'opacity 0.2s',
        }}
      >
        delete
      </button>
    </div>
  );
} 