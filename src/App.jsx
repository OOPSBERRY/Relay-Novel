import { useState } from 'react';
import Home from './screens/Home';
import TeacherEntry from './screens/TeacherEntry';
import TeacherWait from './screens/TeacherWait';
import TeacherMonitor from './screens/TeacherMonitor';
import StudentJoin from './screens/StudentJoin';
import StudentWait from './screens/StudentWait';
import StudentWrite from './screens/StudentWrite';
import StoryFinished from './screens/StoryFinished';

export default function App() {
  const [screen, setScreen] = useState('home');
  const [roomCode, setRoomCode] = useState('');
  const [myId, setMyId] = useState('');
  const [myName, setMyName] = useState('');
  const [isTeacher, setIsTeacher] = useState(false);

  function reset() {
    setScreen('home');
    setRoomCode('');
    setMyId('');
    setMyName('');
    setIsTeacher(false);
  }

  const screens = {
    home: (
      <Home
        onTeacher={() => setScreen('teacher-entry')}
        onStudent={() => setScreen('student-join')}
      />
    ),
    'teacher-entry': (
      <TeacherEntry
        onCreated={(code) => {
          setRoomCode(code);
          setIsTeacher(true);
          setScreen('teacher-wait');
        }}
        onRejoined={(code, status) => {
          setRoomCode(code);
          setIsTeacher(true);
          setScreen(status === 'waiting' ? 'teacher-wait' : status === 'finished' ? 'story-finished' : 'teacher-monitor');
        }}
        onBack={() => setScreen('home')}
      />
    ),
    'teacher-wait': (
      <TeacherWait
        roomCode={roomCode}
        onStarted={() => setScreen('teacher-monitor')}
        onBack={reset}
      />
    ),
    'teacher-monitor': (
      <TeacherMonitor
        roomCode={roomCode}
        onFinished={() => setScreen('story-finished')}
        onBack={reset}
      />
    ),
    'student-join': (
      <StudentJoin
        onJoined={(code, id, name) => {
          setRoomCode(code);
          setMyId(id);
          setMyName(name);
          setScreen('student-wait');
        }}
        onBack={() => setScreen('home')}
      />
    ),
    'student-wait': (
      <StudentWait
        roomCode={roomCode}
        myId={myId}
        myName={myName}
        onStarted={() => setScreen('student-write')}
      />
    ),
    'student-write': (
      <StudentWrite
        roomCode={roomCode}
        myId={myId}
        myName={myName}
        onFinished={() => setScreen('story-finished')}
      />
    ),
    'story-finished': (
      <StoryFinished
        roomCode={roomCode}
        isTeacher={isTeacher}
        onHome={reset}
      />
    ),
  };

  return (
    <div className="app">
      {screens[screen]}
      <footer className="app-footer no-print">Created by. 민프피</footer>
    </div>
  );
}
