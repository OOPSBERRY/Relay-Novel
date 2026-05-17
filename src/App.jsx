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
const TEACHER_KEY = 'relay_teacher_session';

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

  // 새로고침 복구
  useEffect(() => {
    async function tryRecover() {
      // 교사 복구
      try {
        const teacherSaved = localStorage.getItem(TEACHER_KEY);
        if (teacherSaved) {
          const { roomCode: rc, password } = JSON.parse(teacherSaved);
          const { data: room } = await supabase.from('rooms').select('*').eq('code', rc).single();
          if (room && room.teacher_password === password && room.status !== 'finished') {
            setRoomCode(rc);
            setIsTeacher(true);
            if (room.status === 'waiting') setScreen('teacher-wait');
            else if (room.status === 'playing') setScreen('teacher-monitor');
            else if (room.status === 'group_monitoring') {
              setGroupRoomCodes(room.player_order || []);
              setScreen('teacher-group-monitor');
            }
            setRecovering(false);
            return;
          } else {
            localStorage.removeItem(TEACHER_KEY);
          }
        }
      } catch { localStorage.removeItem(TEACHER_KEY); }

      // 학생 복구
      try {
        const saved = sessionStorage.getItem(SESSION_KEY);
        if (saved) {
          const { roomCode: rc, myId: id, myName: name } = JSON.parse(saved);
          const { data } = await supabase.from('rooms').select('status').eq('code', rc).single();
          if (data?.status === 'playing') {
            setRoomCode(rc); setMyId(id); setMyName(name);
            setScreen('student-write');
            setRecovering(false);
            return;
          }
          sessionStorage.removeItem(SESSION_KEY);
        }
      } catch { sessionStorage.removeItem(SESSION_KEY); }

      setRecovering(false);
    }
    tryRecover();
  }, []);

  function reset() {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(TEACHER_KEY);
    setScreen('home');
    setRoomCode(''); setMyId(''); setMyName('');
    setIsTeacher(false); setGroupRoomCodes([]);
  }

  function saveTeacherSession(code, password) {
    localStorage.setItem(TEACHER_KEY, JSON.stringify({ roomCode: code, password }));
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
        onCreated={(code, password) => {
          saveTeacherSession(code, password);
          setRoomCode(code); setIsTeacher(true); setScreen('teacher-wait');
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
      <StoryFinished
        roomCode={roomCode}
        isTeacher={isTeacher}
        onHome={groupRoomCodes.length > 0 ? () => setScreen('teacher-group-monitor') : reset}
        backLabel={groupRoomCodes.length > 0 ? '모둠으로 돌아가기' : '처음으로'}
      />
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
