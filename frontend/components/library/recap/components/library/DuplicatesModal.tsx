"use client";

interface DuplicatePair {
  paper_a: { id: string; title: string };
  paper_b: { id: string; title: string };
  similarity_score: number;
}

interface Props {
  pairs: DuplicatePair[];
  onRemove: (paperId: string) => void;
  onClose: () => void;
}

export default function DuplicatesModal({ pairs, onRemove, onClose }: Props) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-lg shadow-2xl flex flex-col gap-4 max-h-[80vh]">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">
            Duplicate Papers
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition">
            ✕
          </button>
        </div>

        {pairs.length === 0 ? (
          <p className="text-sm text-gray-400">
            No duplicates found. Your library looks clean ✓
          </p>
        ) : (
          <div className="overflow-y-auto flex flex-col gap-4">
            <p className="text-xs text-gray-500">
              {pairs.length} duplicate pair{pairs.length !== 1 ? "s" : ""} found (similarity ≥ 85%)
            </p>
            {pairs.map((pair, i) => (
              <div
                key={i}
                className="bg-gray-800 rounded-xl p-4 flex flex-col gap-3 border border-gray-700"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-xs text-gray-400 mb-1">Paper A</p>
                    <p className="text-sm text-gray-200 line-clamp-2">{pair.paper_a.title}</p>
                  </div>
                  <button
                    onClick={() => onRemove(pair.paper_a.id)}
                    className="text-xs text-red-400 hover:text-red-300 whitespace-nowrap border border-red-800 hover:border-red-600 px-2 py-1 rounded-lg transition"
                  >
                    Remove
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex-1 border-t border-gray-700" />
                  <span className="text-xs text-yellow-500 bg-yellow-950 px-2 py-0.5 rounded-full">
                    {Math.round(pair.similarity_score * 100)}% similar
                  </span>
                  <div className="flex-1 border-t border-gray-700" />
                </div>

                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-xs text-gray-400 mb-1">Paper B</p>
                    <p className="text-sm text-gray-200 line-clamp-2">{pair.paper_b.title}</p>
                  </div>
                  <button
                    onClick={() => onRemove(pair.paper_b.id)}
                    className="text-xs text-red-400 hover:text-red-300 whitespace-nowrap border border-red-800 hover:border-red-600 px-2 py-1 rounded-lg transition"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end mt-2">
          <button
            onClick={onClose}
            className="text-sm text-gray-400 hover:text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
