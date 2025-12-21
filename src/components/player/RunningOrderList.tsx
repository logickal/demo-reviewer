'use client';

import React from 'react';
import { DragDropContext, Droppable, Draggable, OnDragEndResponder } from '@hello-pangea/dnd';

import type { FileItem } from './types';
import { formatTime } from './utils';

interface RunningOrderListProps {
  playlist: FileItem[];
  currentTrack: FileItem | null;
  isGuest: boolean;
  trackDurations: Record<string, number>;
  onSelectTrack: (track: FileItem) => void;
  onReorder: OnDragEndResponder;
}

const RunningOrderList = ({
  playlist,
  currentTrack,
  isGuest,
  trackDurations,
  onSelectTrack,
  onReorder,
}: RunningOrderListProps) => {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
          <span className="w-1.5 h-6 bg-blue-500 rounded-full"></span>Running Order
        </h2>
        {playlist.length > 0 && playlist.every((f) => trackDurations[f.name] !== undefined) && (
          <span className="text-xs font-bold text-gray-400 bg-gray-50 px-3 py-1 rounded-full uppercase tracking-wider">
            Total: {formatTime(playlist.reduce((sum, f) => sum + (trackDurations[f.name] || 0), 0))}
          </span>
        )}
      </div>
      <DragDropContext onDragEnd={onReorder}>
        <Droppable droppableId="playlist">
          {(provided) => (
            <ul {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
              {playlist.map((item, index) => (
                <Draggable key={item.name} draggableId={item.name} index={index} isDragDisabled={isGuest}>
                  {(provided) => (
                    <li
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      onClick={() => onSelectTrack(item)}
                      className={`group p-4 rounded-2xl border cursor-pointer flex items-center gap-4 transition-all ${
                        currentTrack?.name === item.name
                          ? 'bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-100'
                          : 'bg-white border-gray-100 hover:border-orange-200 text-gray-900'
                      }`}
                    >
                      <span
                        className={`text-[10px] font-black w-6 h-6 rounded-lg flex items-center justify-center ${
                          currentTrack?.name === item.name
                            ? 'bg-white/20'
                            : 'bg-gray-50 text-gray-400 group-hover:bg-orange-50 group-hover:text-orange-500'
                        }`}
                      >
                        {index + 1}
                      </span>
                      <span className="font-bold text-sm grow truncate">{item.name}</span>
                      {!isGuest && (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className={`h-4 w-4 ${currentTrack?.name === item.name ? 'text-white/50' : 'text-gray-300'}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                        </svg>
                      )}
                    </li>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </ul>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
};

export default RunningOrderList;
