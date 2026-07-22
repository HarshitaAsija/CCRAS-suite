import React, { useState, useEffect } from 'react';
import { Plus, Folder, Trash2 } from 'lucide-react';

interface Collection {
  id: string;
  name: string;
  description: string | null;
  hypothesis_seed: string | null;
  paper_count: number;
  is_public: boolean;
  user_id: string;
  created_at: string;
  updated_at: string;
}

interface CollectionsPanelProps {};

export const CollectionsPanel: React.FC<CollectionsPanelProps> = () => {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>('');
  const [newDescription, setNewDescription] = useState<string>('');
  const [newHypothesis, setNewHypothesis] = useState<string>('');
  const [newIsPublic, setNewIsPublic] = useState<boolean>(false);

  // Determine if we are in dev mode (for authentication)
  const isDevMode = process.env.NEXT_PUBLIC_DEV_MODE === 'true';
  const authHeaders = isDevMode
    ? { Authorization: `Bearer dev-token` }
    : {};

  // Fetch collections
  const fetchCollections = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/collections', {
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        credentials: 'include', // if we need cookies
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch collections: ${response.status}`);
      }
      const data: Collection[] = await response.json();
      setCollections(data);
    } catch (err) {
      console.error('Error fetching collections:', err);
      setError(
        err instanceof Error ? err.message : 'An unknown error occurred'
      );
    } finally {
      setLoading(false);
    }
  };

  // Create a new collection
  const createCollection = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const response = await fetch('/api/collections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({
          name: newName,
          description: newDescription || null,
          hypothesis_seed: newHypothesis || null,
          is_public: newIsPublic,
        }),
      });
      if (!response.ok) {
        throw new Error(`Failed to create collection: ${response.status}`);
      }
      const newCollection: Collection = await response.json();
      setCollections((prev) => [newCollection, ...prev]);
      // Reset form
      setNewName('');
      setNewDescription('');
      setNewHypothesis('');
      setNewIsPublic(false);
      setCreating(false);
    } catch (err) {
      console.error('Error creating collection:', err);
      setError(
        err instanceof Error ? err.message : 'An unknown error occurred'
      );
      setCreating(false);
    }
  };

  // Delete a collection
  const deleteCollection = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this collection?'))
      return;
    try {
      const response = await fetch(`/api/collections/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
      });
      if (!response.ok) {
        throw new Error(`Failed to delete collection: ${response.status}`);
      }
      setCollections((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      console.error('Error deleting collection:', err);
      setError(
        err instanceof Error ? err.message : 'An unknown error occurred'
      );
    }
  };

  useEffect(() => {
    fetchCollections();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-bold text-foreground">My Collections</h2>
        <div className="flex items-center gap-2 mt-2 sm:mt-0">
          <button
            onClick={() => {
              // Open a simple prompt for now; we can replace with a modal later
              // For simplicity, we'll use the form fields below
              // We'll just set a flag to show the form
              // We'll implement a toggle for the form visibility
            }}
            className="btn btn-primary"
          >
            <Plus className="mr-2" /> New Collection
          </button>
        </div>
      </div>

      {/* Form for creating a new collection */}
      <div
        className={`border rounded-lg p-4 mt-4 ${
          creating ? 'animate-pulse' : ''
        }`}
      >
        <h3 className="font-semibold mb-2">Create New Collection</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-1">
              Name
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Collection name"
              className="input input-bordered w-full"
              disabled={creating}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Description
            </label>
            <input
              type="text"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Description (optional)"
              className="input input-bordered w-full"
              disabled={creating}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Hypothesis Seed
            </label>
            <textarea
              value={newHypothesis}
              onChange={(e) => setNewHypothesis(e.target.value)}
              placeholder="Research hypothesis (optional)"
              className="textarea textarea-bordered w-full min-h-[60px]"
              disabled={creating}
            />
          </div>
          <div className="flex items-end">
            <label className="cursor-select text-sm font-medium mb-2">
              Public
            </label>
            <input
              type="checkbox"
              checked={newIsPublic}
              onChange={(e) => setNewIsPublic(e.target.checked)}
              className="checkbox checkbox-primary ml-2"
              disabled={creating}
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={() => {
              setNewName('');
              setNewDescription('');
              setNewHypothesis('');
              setNewIsPublic(false);
            }}
            className="btn btn-outline"
            disabled={creating}
          >
            Cancel
          </button>
          <button
            onClick={createCollection}
            className="btn btn-primary"
            disabled={creating || !newName.trim()}
          >
            {creating ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Collections list */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-8">
            Loading collections...
          </div>
        ) : collections.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No collections yet. Click "New Collection" to create your first
            collection.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {collections.map((collection) => (
              <div
                key={collection.id}
                className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => {
                  // TODO: Navigate to collection detail view
                  alert(`Viewing collection: ${collection.name}`);
                }}
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="flex-shrink-0">
                    <Folder
                      className="h-5 w-5 text-primary"
                    />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{collection.name}</h3>
                    {collection.description && (
                      <p className="text-sm text-muted-foreground">
                        {collection.description}
                      </p>
                    )}
                    {collection.hypothesis_seed && (
                      <p className="text-sm text-muted-foreground italic">
                        {collection.hypothesis_seed}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span className="badge badge-outline">
                        {collection.paper_count} papers
                      </span>
                      <span className="badge badge-outline">
                        {collection.is_public ? 'Public' : 'Private'}
                      </span>
                      <span className="badge badge-outline">
                        {new Date(collection.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteCollection(collection.id);
                    }}
                    className="btn btn-ghost btn-sm"
                    aria-label="Delete collection"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};