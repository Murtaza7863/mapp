import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import type { Item } from "../types";

import { ContainerCard, containerProgress } from "../components/ContainerCard";
import { FolderIcon } from "../components/icons";
import { ItemForm } from "../components/ItemForm";
import { EmptyState, PageHeader, SectionHeader } from "../components/ui";
import { useCategories } from "../hooks/useCategories";
import { useItems } from "../hooks/useItems";
import { getRootProjects } from "../lib/projects";

export function ProjectsView() {
  const { items, addItem } = useItems();
  const { categories } = useCategories();
  const [showForm, setShowForm] = useState(false);

  const folders = useMemo(() => getRootProjects(items), [items]);

  const byArea = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const folder of folders) {
      const list = map.get(folder.categoryId) ?? [];
      list.push(folder);
      map.set(folder.categoryId, list);
    }
    return map;
  }, [folders]);

  return (
    <div className="view-page">
      <PageHeader
        title="All folders"
        subtitle="Across every area"
        action={
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="btn-primary rounded-xl px-3.5 py-2 text-sm"
          >
            New
          </button>
        }
      />

      {folders.length === 0 ? (
        <EmptyState
          icon={<FolderIcon className="h-4 w-4" />}
          title="No folders yet"
          description="Open an area and tap + New folder, or create one here."
        />
      ) : (
        <div className="page-block">
          {categories.map((cat) => {
            const list = byArea.get(cat.id) ?? [];
            if (list.length === 0) return null;
            return (
              <section key={cat.id} className="section-block">
                <SectionHeader title={cat.name} count={list.length} />
                <div className="item-list">
                  {list.map((folder) => (
                    <Link
                      key={folder.id}
                      to={`/folders/${folder.id}`}
                      state={{
                        backTo: "/projects",
                        backLabel: "All folders",
                        areaId: cat.id,
                      }}
                    >
                      <ContainerCard
                        item={folder}
                        progress={containerProgress(folder, items)}
                        to={`/folders/${folder.id}`}
                        allItems={items}
                        subtitle={
                          folder.goalCount
                            ? `Goal: ${folder.goalCount}`
                            : undefined
                        }
                      />
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {showForm && (
        <ItemForm
          categories={categories}
          defaultType="project"
          onClose={() => setShowForm(false)}
          onSave={async (data) => {
            await addItem({
              ...data,
              type: "project",
              categoryId: data.categoryId ?? categories[0]?.id ?? "",
            });
            setShowForm(false);
          }}
        />
      )}
    </div>
  );
}
