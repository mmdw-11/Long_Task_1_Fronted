export type EditedFile = { path: string; workspace: string; action: string };

// Only successful workspace write results are evidence, never model prose or shell output.
export function editedFiles(events: Record<string, any>[]): EditedFile[] {
  const files = new Map<string, EditedFile>();
  for (const event of events) {
    const calls = event.type === 'tool_result' ? [event.tool_call] : event.type === 'node_end' ? event.tool_calls || [] : [];
    for (const call of calls) {
      if (!call || call.status !== 'succeeded') continue;
      const result = call.result, name = call.name || call.tool_name;
      if (!result || typeof result !== 'object') continue;
      const paths = name === 'workspace_apply_patch' ? [result.path] : name === 'workspace_write_files' && Array.isArray(result.files) ? result.files : [];
      for (const path of paths) {
        if (typeof path !== 'string' || !path) continue;
        const workspace = String(call.arguments?.workspace_id || '');
        const key = workspace + ':' + path.replaceAll('\\', '/');
        if (!files.has(key)) files.set(key, { path, workspace, action: name === 'workspace_apply_patch' ? result.created ? '新增' : '修改' : '写入' });
      }
    }
  }
  return [...files.values()];
}
