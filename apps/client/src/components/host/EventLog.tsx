/**
 * EventLog — real-time event log for the host panel.
 *
 * Shows a scrollable list of recent game events, each with timestamp,
 * event type, player name, and details.  Events are color-coded by
 * type (join=green, leave=red, action=blue, system=gray).  The list
 * auto-scrolls to the bottom when new events arrive, and an export
 * button downloads the full log as CSV.
 */

import { useRef, useEffect, useState, memo, useCallback } from 'react';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../store/game-store';
import { slideIn } from '../../animations/variants';
import type { GameEvent } from '@treasure-contest/shared';

/** Event category for color-coding. */
type EventCategory = 'join' | 'leave' | 'action' | 'system';

/** Maps an eventType string to a display category. */
function categorizeEvent(eventType: string): EventCategory {
  const lower = eventType.toLowerCase();
  if (lower.includes('join') || lower.includes('connect') || lower.includes('ready')) {
    return 'join';
  }
  if (lower.includes('leave') || lower.includes('disconnect') || lower.includes('remove') || lower.includes('end') || lower.includes('skip')) {
    return 'leave';
  }
  if (lower.includes('submit') || lower.includes('select') || lower.includes('pick') || lower.includes('reveal') || lower.includes('advance') || lower.includes('start') || lower.includes('pause') || lower.includes('resume')) {
    return 'action';
  }
  return 'system';
}

const CATEGORY_STYLE: Record<EventCategory, { text: string; dot: string; bg: string }> = {
  join: { text: 'text-emerald-400', dot: 'bg-emerald-500', bg: 'bg-emerald-950/20' },
  leave: { text: 'text-rose-400', dot: 'bg-rose-500', bg: 'bg-rose-950/20' },
  action: { text: 'text-sky-400', dot: 'bg-sky-500', bg: 'bg-sky-950/20' },
  system: { text: 'text-slate-400', dot: 'bg-slate-500', bg: 'bg-slate-900/30' },
};

const CATEGORY_LABEL: Record<EventCategory, string> = {
  join: '加入',
  leave: '离开',
  action: '操作',
  system: '系统',
};

/** Formats an ISO timestamp to HH:MM:SS. */
function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return '--:--:--';
  }
}

/** Extracts a short description from the event data. */
function describeEvent(event: GameEvent): string {
  if (event.data && typeof event.data === 'object') {
    const data = event.data as Record<string, unknown>;
    // Try common fields
    if (data.number !== undefined) return `数字: ${data.number}`;
    if (data.gemId !== undefined) return `宝石: ${data.gemId}`;
    if (data.phase !== undefined) return `阶段: ${data.phase}`;
    if (data.reason !== undefined) return `原因: ${data.reason}`;
    if (data.targetPlayers !== undefined) return `目标人数: ${data.targetPlayers}`;
  }
  return '';
}

/** Exports the event log as a CSV file. */
function exportCSV(events: GameEvent[]): void {
  const headers = ['时间', '回合', '阶段', '事件类型', '分类', '玩家ID', '详情'];
  const rows = events.map((e) => [
    e.timestamp,
    e.round ?? '',
    e.phase,
    e.eventType,
    CATEGORY_LABEL[categorizeEvent(e.eventType)],
    e.playerId ?? '',
    describeEvent(e).replace(/,/g, ' '),
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell)}"`).join(','))
    .join('\n');

  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `event-log-${new Date().toISOString().slice(0, 19)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Renders a single event row. */
function EventRow({ event }: { event: GameEvent }) {
  const category = categorizeEvent(event.eventType);
  const style = CATEGORY_STYLE[category];
  const detail = describeEvent(event);

  return (
    <motion.div
      variants={slideIn}
      initial="hidden"
      animate="visible"
      exit="exit"
      layout
      className={clsx(
        'flex items-start gap-2 rounded px-2 py-1 text-[11px]',
        style.bg,
      )}
    >
      {/* Category dot */}
      <span className={clsx('mt-1 h-1.5 w-1.5 shrink-0 rounded-full', style.dot)} />

      {/* Timestamp */}
      <span className="shrink-0 font-mono text-slate-500">
        {formatTime(event.timestamp)}
      </span>

      {/* Event type */}
      <span className={clsx('shrink-0 font-medium', style.text)}>
        {event.eventType}
      </span>

      {/* Round badge */}
      {event.round !== null && (
        <span className="shrink-0 rounded bg-slate-700 px-1 text-[9px] text-slate-400">
          R{event.round}
        </span>
      )}

      {/* Detail */}
      {detail && (
        <span className="shrink-0 text-slate-500">{detail}</span>
      )}

      {/* Player ID */}
      {event.playerId && (
        <span className="ml-auto shrink-0 truncate text-[10px] text-slate-600">
          {event.playerId.slice(0, 8)}
        </span>
      )}
    </motion.div>
  );
}

function EventLogComponent() {
  const eventLog = useGameStore((s) => s.eventLog);
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [eventLog, autoScroll]);

  // Track whether user is at the bottom
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 40;
    setAutoScroll(isAtBottom);
  }, []);

  const handleExport = useCallback(() => {
    exportCSV(eventLog);
  }, [eventLog]);

  // Show latest 100 events (reversed for display: newest at bottom)
  const displayEvents = eventLog.slice(-100);

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-700 bg-slate-800/40 p-4">
      {/* Header */}
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-300">
          事件日志
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500">
            {eventLog.length} 条
          </span>
          <button
            onClick={handleExport}
            disabled={eventLog.length === 0}
            className="flex items-center gap-1 rounded bg-slate-700 px-2 py-0.5 text-[10px] font-medium text-slate-300 transition-colors hover:bg-slate-600 disabled:opacity-40"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            导出
          </button>
        </div>
      </div>

      {/* Scrollable event list */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 space-y-1 overflow-y-auto pr-1"
        style={{ minHeight: '200px', maxHeight: '400px' }}
      >
        {displayEvents.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-slate-600">
            暂无事件记录
          </div>
        ) : (
          <AnimatePresence>
            {displayEvents.map((event) => (
              <EventRow key={event.id} event={event} />
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Auto-scroll indicator */}
      {!autoScroll && eventLog.length > 0 && (
        <button
          onClick={() => {
            setAutoScroll(true);
            if (scrollRef.current) {
              scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }
          }}
          className="mt-1 flex w-full items-center justify-center gap-1 rounded bg-slate-700 py-1 text-[10px] text-slate-400 hover:bg-slate-600"
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
          滚动到最新
        </button>
      )}
    </div>
  );
}

export const EventLog = memo(EventLogComponent);
export default EventLog;
