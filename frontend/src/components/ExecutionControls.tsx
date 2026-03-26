import React, { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../store/store';
import { nextStep, setStatus, setCurrentStep } from '../store/visualizationSlice';
import {
    Play, Pause, SkipBack, SkipForward, ChevronFirst, ChevronLast, Gauge
} from 'lucide-react';
import { setSpeed } from '../store/visualizationSlice';

const SPEED_OPTIONS = [
    { label: '0.5×', value: 1600 },
    { label: '1×', value: 800 },
    { label: '2×', value: 400 },
    { label: '3×', value: 200 },
    { label: '4×', value: 100 },
];

const ExecutionControls: React.FC = () => {
    const dispatch = useDispatch<AppDispatch>();
    const { steps, currentStep, status, playbackSpeed } = useSelector(
        (s: RootState) => s.visualization
    );
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const isPlaying = status === 'playing';
    const canStep = steps.length > 0;
    const atEnd = currentStep >= steps.length - 1;
    const atStart = currentStep <= 0;

    // Auto-play logic
    useEffect(() => {
        if (isPlaying) {
            intervalRef.current = setInterval(() => {
                dispatch(nextStep());
            }, playbackSpeed);
        } else {
            if (intervalRef.current) clearInterval(intervalRef.current);
        }
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [isPlaying, playbackSpeed, dispatch]);

    // Stop at end
    useEffect(() => {
        if (status === 'done' && intervalRef.current) {
            clearInterval(intervalRef.current);
        }
    }, [status]);

    const handlePlayPause = () => {
        if (isPlaying) {
            dispatch(setStatus('paused'));
        } else {
            if (atEnd) dispatch(setCurrentStep(0));
            dispatch(setStatus('playing'));
        }
    };

    const handleFirst = () => {
        dispatch(setStatus('paused'));
        dispatch(setCurrentStep(0));
    };

    const handleLast = () => {
        dispatch(setStatus('paused'));
        dispatch(setCurrentStep(steps.length - 1));
    };

    const handlePrev = () => {
        dispatch(setStatus('paused'));
        dispatch(setCurrentStep(currentStep - 1));
    };

    const handleNext = () => {
        dispatch(setStatus('paused'));
        dispatch(setCurrentStep(currentStep + 1));
    };

    return (
        <div className="flex items-center gap-3 px-4 py-2 bg-[#1a1a2e] border-t border-gray-700/50 select-none">
            {/* Step counter */}
            <span className="text-xs font-mono text-gray-400 min-w-[72px]">
                {canStep
                    ? `Step ${currentStep + 1} / ${steps.length}`
                    : 'No steps'}
            </span>

            {/* Controls */}
            <div className="flex items-center gap-1">
                <button
                    onClick={handleFirst}
                    disabled={!canStep || atStart}
                    className="control-btn"
                    title="First step"
                >
                    <ChevronFirst size={16} />
                </button>
                <button
                    onClick={handlePrev}
                    disabled={!canStep || atStart}
                    className="control-btn"
                    title="Previous step"
                >
                    <SkipBack size={16} />
                </button>

                {/* Play/Pause */}
                <button
                    onClick={handlePlayPause}
                    disabled={!canStep}
                    className={`control-btn-primary ${isPlaying ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-700'}`}
                    title={isPlaying ? 'Pause' : 'Play'}
                >
                    {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                </button>

                <button
                    onClick={handleNext}
                    disabled={!canStep || atEnd}
                    className="control-btn"
                    title="Next step"
                >
                    <SkipForward size={16} />
                </button>
                <button
                    onClick={handleLast}
                    disabled={!canStep || atEnd}
                    className="control-btn"
                    title="Last step"
                >
                    <ChevronLast size={16} />
                </button>
            </div>

            {/* Speed selector */}
            <div className="flex items-center gap-2 ml-auto">
                <Gauge size={14} className="text-gray-400" />
                <div className="flex gap-1">
                    {SPEED_OPTIONS.map(opt => (
                        <button
                            key={opt.label}
                            onClick={() => dispatch(setSpeed(opt.value))}
                            className={`text-xs px-2 py-0.5 rounded font-mono transition-colors ${playbackSpeed === opt.value
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ExecutionControls;
