interface Props {
  categoryName: string;
  subgroups: string[];
}

export function SubgroupQuickAddHelp({ categoryName, subgroups }: Props) {
  const exampleGroup = subgroups[0] ?? "Tasks";
  const tag = categoryName.toLowerCase().replace(/\s+/g, "");

  return (
    <details className="item-card rounded-xl p-3 text-sm">
      <summary className="text-muted cursor-pointer text-xs font-medium">
        Plot tips for {categoryName}
      </summary>
      <ul className="text-muted mt-2 space-y-1.5 text-[11px] leading-relaxed">
        <li>
          Add a task:{" "}
          <code className="text-primary">buy milk tomorrow #{tag}</code>
        </li>
        <li>
          Folder + task:{" "}
          <code className="text-primary">Travel: pack bags friday</code>
        </li>
        {subgroups.length > 0 && (
          <li>
            Folder + subgroup:{" "}
            <code className="text-primary">
              Trip {exampleGroup}: book flights
            </code>
          </li>
        )}
        <li>
          Update existing: <code className="text-primary">done: buy milk</code>
          {" · "}
          <code className="text-primary">snooze dentist until friday</code>
        </li>
        <li>
          Open this area:{" "}
          <code className="text-primary">show area {categoryName}</code>
        </li>
      </ul>
    </details>
  );
}
