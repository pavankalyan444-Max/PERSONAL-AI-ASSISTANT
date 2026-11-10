import { useState, useEffect } from 'react';

interface DbMemory {
  id: number;
  category: string;
  key: string;
  content: string;
  importance: number;
  created_at: number;
  updated_at: number;
}

export function MemoryView() {
  const [dbMemories, setDbMemories] = useState<DbMemory[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [newKey, setNewKey] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState('preference');
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchMemories = async () => {
    try {
      const res = await fetch('/api/memory');
      if (res.ok) {
        const data = await res.json();
        if (data.memories) {
          setDbMemories(data.memories);
        }
      }
    } catch {
      // fallback
    }
  };

  useEffect(() => {
    fetchMemories();
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to permanently delete this memory?')) return;
    try {
      await fetch('/api/memory', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      fetchMemories();
    } catch {
      // ignore
    }
  };

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey.trim() || !newContent.trim()) return;

    try {
      await fetch('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: newCategory,
          key: newKey.trim(),
          content: newContent.trim(),
          importance: 7,
        }),
      });
      setNewKey('');
      setNewContent('');
      setShowAddModal(false);
      fetchMemories();
    } catch {
      // ignore
    }
  };

  const categories = ['all', 'preference', 'profile', 'fact', 'project'];

  // Filter memories
  const filteredMemories = dbMemories.filter((m) => {
    const matchesCat = activeCategory === 'all' || m.category.toLowerCase() === activeCategory;
    const matchesQuery = !searchQuery.trim() || 
      m.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesQuery;
  });

  return (
    <div className="h-full w-full overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-nova-border/30 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-violet-400 animate-pulse shadow-[0_0_10px_#9A8CFF]" />
            <h1 className="font-mono text-lg font-bold text-nova-text tracking-wider">PERSISTENT MEMORY REPOSITORY</h1>
          </div>
          <p className="font-mono text-xs text-nova-textDim mt-1">
            SQLite permanent storage • Long-term user preferences • Project architectural context
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="px-3 py-1 rounded-lg glass-panel border border-violet-500/40 font-mono text-xs text-violet-300">
            {dbMemories.length} PERSISTED RECORDS
          </span>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3 py-1 rounded-lg bg-violet-500/20 border border-violet-500/50 hover:bg-violet-500/30 text-violet-300 text-xs font-mono font-bold transition-all"
          >
            + ADD MEMORY
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1 rounded-lg text-xs font-mono uppercase tracking-wider transition-all ${
                activeCategory === cat
                  ? 'bg-violet-500/20 border border-violet-500/50 text-violet-300 font-bold'
                  : 'text-nova-textDim hover:text-nova-text hover:bg-nova-border/20 border border-transparent'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="w-full sm:w-64">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search persistent memories..."
            className="w-full bg-nova-bg/90 border border-nova-border/50 rounded-xl px-3 py-1.5 text-xs font-mono text-nova-text placeholder:text-nova-textDim/50 focus:outline-none focus:border-violet-500"
          />
        </div>
      </div>

      {/* Add Memory Modal */}
      {showAddModal && (
        <form onSubmit={handleAddMemory} className="glass-panel p-5 rounded-2xl border border-violet-500/50 space-y-4 animate-in fade-in duration-150">
          <div className="flex justify-between items-center border-b border-nova-border/30 pb-2">
            <h3 className="font-mono text-xs font-bold text-violet-300 uppercase tracking-wider">RECORD NEW PERMANENT MEMORY</h3>
            <button type="button" onClick={() => setShowAddModal(false)} className="text-nova-textDim hover:text-nova-text text-sm">✕</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-mono text-nova-textDim mb-1 uppercase">CATEGORY</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="w-full bg-nova-bg border border-nova-border/50 rounded-lg p-2 text-xs text-nova-text font-mono"
              >
                <option value="preference">Preference</option>
                <option value="profile">Profile</option>
                <option value="fact">Fact</option>
                <option value="project">Project Note</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-mono text-nova-textDim mb-1 uppercase">KEY / IDENTIFIER</label>
              <input
                type="text"
                placeholder="e.g. preferred_theme, coding_style"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                className="w-full bg-nova-bg border border-nova-border/50 rounded-lg p-2 text-xs text-nova-text font-mono"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-mono text-nova-textDim mb-1 uppercase">MEMORY DETAIL</label>
            <textarea
              rows={3}
              placeholder="State the permanent preference or fact..."
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              className="w-full bg-nova-bg border border-nova-border/50 rounded-lg p-2 text-xs text-nova-text font-mono"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="px-3 py-1.5 rounded-lg border border-nova-border/40 text-xs font-mono text-nova-textDim hover:bg-nova-border/20"
            >
              CANCEL
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-violet-500/20 border border-violet-500/50 hover:bg-violet-500/30 text-violet-300 text-xs font-mono font-bold"
            >
              SAVE TO SQLITE
            </button>
          </div>
        </form>
      )}

      {/* Memories Grid */}
      {filteredMemories.length === 0 ? (
        <div className="glass-panel p-8 rounded-2xl border border-nova-border/30 text-center font-mono text-xs text-nova-textDim">
          No memory entries found matching your criteria. Memories are recorded automatically as you interact with ORBIT.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMemories.map((mem) => (
            <div
              key={mem.id}
              className="glass-panel p-4 rounded-xl border border-nova-border/40 hover:border-violet-500/40 transition-all duration-300 space-y-2.5 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded text-[9px] font-mono uppercase tracking-wider bg-violet-500/15 border border-violet-500/30 text-violet-300">
                    {mem.category}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[9px] text-nova-textDim">
                      IMPORTANCE {mem.importance}/10
                    </span>
                    <button
                      onClick={() => handleDelete(mem.id)}
                      className="text-nova-textDim hover:text-red-400 text-xs transition-colors"
                      title="Delete Memory"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <h3 className="font-mono text-sm font-bold text-nova-text truncate">{mem.key}</h3>
                <p className="text-xs text-nova-textDim/80 leading-relaxed break-words">{mem.content}</p>
              </div>

              <div className="pt-2 border-t border-nova-border/20 flex items-center justify-between text-[9px] font-mono text-nova-textDim/60">
                <span>UPDATED</span>
                <span>{new Date(mem.updated_at * 1000).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
