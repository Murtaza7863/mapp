interface Props {
  categoryName: string;
  subgroups: string[];
}

export function SubgroupQuickAddHelp({ categoryName, subgroups }: Props) {
  const exampleGroup = subgroups[0]?.toLowerCase() ?? "tasks";
  const tag = categoryName.toLowerCase().replace(/\s+/g, "");

  return (
    <details className="item-card rounded-xl p-3 text-sm">
      <summary className="text-zinc-400 cursor-pointer text-xs font-medium">
        Quick-add syntax for {categoryName}
      </summary>
      <ul className="text-zinc-500 mt-2 space-y-1.5 text-[11px] leading-relaxed">
        <li>
          <code className="text-zinc-300">
            Project name {exampleGroup}: Task title
          </code>{" "}
          — folder + subgroup + task
        </li>
        <li>
          <code className="text-zinc-300">Folder name: Task title</code> —
          folder + task
        </li>
        <li>
          Add dates: <code className="text-zinc-300">tomorrow 9am</code>,{" "}
          <code className="text-zinc-300">friday 5pm</code>
        </li>
        <li>
          Tag area: <code className="text-zinc-300">#{tag}</code> · priority:{" "}
          <code className="text-zinc-300">!</code>
        </li>
      </ul>
    </details>
  );
}
