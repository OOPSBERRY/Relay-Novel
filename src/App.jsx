import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import Home from './screens/Home';
import TeacherEntry from './screens/TeacherEntry';
import TeacherWait from './screens/TeacherWait';
import TeacherMonitor from './screens/TeacherMonitor';
import TeacherGroupMonitor from './screens/TeacherGroupMonitor';
import StudentJoin from './screens/StudentJoin';
import StudentWait from './screens/StudentWait';
import StudentWrite from './screens/StudentWrite';
import StoryFinished from './screens/StoryFinished';
import ClassSetup from './screens/ClassSetup';
import ClassLibrary from './screens/ClassLibrary';
import StoryReader from './screens/StoryReader';

const SESSION_KEY = 'relay_student_session';

export default function App() {
  const [screen, setScreen] = useState('home');
  const [roomCode, setRoomCode] = useState('');
  const [myId, setMyId] = useState('');
  const [myName, setMyName] = useState('');
  const [isTeacher, setIsTeacher] = useState(false);
  const [classCode, setClassCode] = useState('');
  const [className, setClassName] = useState('');
  const [classId, setClassId] = useState('');
  const [readingCode, setReadingCode] = useState('');
  const [groupRoomCodes, setGroupRoomCodes] = useState([]);
  const [recovering, setRecovering] = useState(true);

  // 새로고침 복구: 진행 중인 방이면 자동으로 글쓰기 화면으로
  useEffect(() => {
    async function tryRecover() {
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (!saved) { setRecovering(false); return; }

      try {
        const { roomCode: rc, myId: id, myName: name } = JSON.parse(saved);
        const { data } = await supabase.from('rooms').select('status').eq('code', rc).single();

        if (data?.status === 'playing') {
          setRoomCode(rc);
          setMyId(id);
          setMyName(name);
          setScreen('student-write');
        } else {
          sessionStorage.removeItem(SESSION_KEY);
        }
      } catch {
        sessionStorage.removeItem(SESSION_KEY);
      }
      setRecovering(false);
    }
    tryRecover();
  }, []);

  function reset() {
    sessionStorage.removeItem(SESSION_KEY);
    setScreen('home');
    setRoomCode(''); setMyId(''); setMyName('');
    setIsTeacher(false); setGroupRoomCodes([]);
  }

  function handleStudentJoined(code, id, name) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ roomCode: code, myId: id, myName: name }));
    setRoomCode(code); setMyId(id); setMyName(name);
    setScreen('student-wait');
  }

  function handleStudentStarted(newRoomCode) {
    if (newRoomCode && newRoomCode !== roomCode) {
      setRoomCode(newRoomCode);
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (saved) {
        try {
          const session = JSON.parse(saved);
          sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, roomCode: newRoomCode }));
        } catch { /* ignore */ }
      }
    }
    setScreen('student-write');
  }

  function handleStudentFinished() {
    sessionStorage.removeItem(SESSION_KEY);
    setScreen('story-finished');
  }

  if (recovering) {
    return (
      <div className="app">
        <div className="screen screen-center">
          <p className="muted">불러오는 중...</p>
        </div>
      </div>
    );
  }

  const screens = {
    home: (
      <Home
        onTeacher={() => setScreen('teacher-entry')}
        onStudent={() => setScreen('student-join')}
        onLibrary={() => setScreen('class-setup')}
      />
    ),
    'teacher-entry': (
      <TeacherEntry
        onCreated={(code) => { setRoomCode(code); setIsTeacher(true); setScreen('teacher-wait'); }}
        onRejoined={(code, status) => {
          setRoomCode(code); setIsTeacher(true);
          setScreen(status === 'waiting' ? 'teacher-wait' : status === 'finished' ? 'story-finished' : 'teacher-monitor');
        }}
        onBack={() => setScreen('home')}
      />
    ),
    'teacher-wait': (
      <TeacherWait
        roomCode={roomCode}
        onStarted={() => setScreen('teacher-monitor')}
        onGroupStarted={(codes) => { setGroupRoomCodes(codes); setScreen('teacher-group-monitor'); }}
        onBack={reset}
      />
    ),
    'teacher-monitor': (
      <TeacherMonitor roomCode={roomCode} onFinished={() => setScreen('story-finished')} onBack={reset} />
    ),
    'teacher-group-monitor': (
      <TeacherGroupMonitor
        parentRoomCode={roomCode}
        groupRoomCodes={groupRoomCodes}
        onViewStory={(code) => { setRoomCode(code); setScreen('story-finished'); }}
        onBack={reset}
      />
    ),
    'student-join': (
      <StudentJoin onJoined={handleStudentJoined} onBack={() => setScreen('home')} />
    ),
    'student-wait': (
      <StudentWait roomCode={roomCode} myId={myId} myName={myName} onStarted={handleStudentStarted} />
    ),
    'student-write': (
      <StudentWrite roomCode={roomCode} myId={myId} myName={myName} onFinished={handleStudentFinished} />
    ),
    'story-finished': (
      <StoryFinished roomCode={roomCode} isTeacher={isTeacher} onHome={reset} />
    ),
    'class-setup': (
      <ClassSetup
        onEnter={(code, name, id) => { setClassCode(code); setClassName(name); setClassId(id); setScreen('class-library'); }}
        onBack={() => setScreen('home')}
      />
    ),
    'class-library': (
      <ClassLibrary
        classCode={classCode}
        className={className}
        classId={classId}
        onRead={(code) => { setReadingCode(code); setScreen('story-reader'); }}
        onBack={() => setScreen('class-setup')}
      />
    ),
    'story-reader': (
      <StoryReader roomCode={readingCode} onBack={() => setScreen('class-library')} />
    ),
  };

  return (
    <div className="app">
      {screens[screen]}
      <footer className="app-footer no-print">Created by. 민프피</footer>
    </div>
  );
}
