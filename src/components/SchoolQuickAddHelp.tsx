export function SchoolQuickAddHelp() {
  return (
    <details className="item-card rounded-xl p-3 text-sm">
      <summary className="text-zinc-400 cursor-pointer text-xs font-medium">
        Quick-add syntax for School
      </summary>
      <ul className="text-zinc-500 mt-2 space-y-1.5 text-[11px] leading-relaxed">
        <li>
          <code className="text-zinc-300">CS 101 homework: Problem set 3</code>{" "}
          — module + subgroup + task
        </li>
        <li>
          <code className="text-zinc-300">Math exam: Midterm review</code>
        </li>
        <li>
          Add dates: <code className="text-zinc-300">tomorrow 9am</code>,{" "}
          <code className="text-zinc-300">friday 5pm</code>
        </li>
        <li>
          Tag area: <code className="text-zinc-300">#school</code> · priority:{" "}
          <code className="text-zinc-300">!</code>
        </li>
      </ul>
    </details>
  );
}
