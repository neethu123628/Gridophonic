import { useEffect, useState } from "react";
import { io } from "socket.io-client";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5002";

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Classroom request failed");
  }

  return data;
}

function makeBlankTracks() {
  return [
    {
      name: "Kick",
      steps: Array(16).fill(false),
      volume: 1,
      pan: 0,
      muted: false
    },
    {
      name: "Snare",
      steps: Array(16).fill(false),
      volume: 1,
      pan: 0,
      muted: false
    },
    {
      name: "Hi-Hat",
      steps: Array(16).fill(false),
      volume: 1,
      pan: 0,
      muted: false
    }
  ];
}

function getId(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  return String(value._id || value.id || "");
}

export default function ClassroomPanel({ user, onOpenBeat, onProjectDeleted }) {
  const [classrooms, setClassrooms] = useState([]);
  const [classroom, setClassroom] = useState(null);

  const [className, setClassName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [beatName, setBeatName] = useState("");
  const [assignmentTitle, setAssignmentTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [editingNotificationId, setEditingNotificationId] = useState("");
  const [editNotificationDraft, setEditNotificationDraft] = useState("");

  const [notifications, setNotifications] = useState([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadClassrooms() {
    try {
      const data = await request("/api/classrooms");
      setClassrooms(data.classrooms || []);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function fetchClassroom(id) {
    const data = await request(`/api/classrooms/${id}`);
    const selectedClassroom = data.classroom || data;

    setClassroom(selectedClassroom);
    setNotifications(selectedClassroom.notifications || []);

    return selectedClassroom;
  }

  async function openClassroom(id) {
    setBusy(true);
    setMessage("");

    try {
      await fetchClassroom(id);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    loadClassrooms();
  }, []);

  // Join this classroom's Socket.IO room to receive its live notifications.
  useEffect(() => {
    if (!classroom?._id) return undefined;

    const socket = io(API_URL, { withCredentials: true });

    socket.on("connect", () => {
      socket.emit(
        "classroom:join",
        { classroomId: classroom._id },
        (result) => {
          if (result?.error) {
            setMessage(result.error);
          }
        }
      );
    });

    socket.on("classroom:notification", (notification) => {
      const currentUserId = getId(user);
      const actorId = getId(notification.actor);

      // The person who created the beat already sees the confirmation.
      if (actorId && actorId === currentUserId) return;

      setNotifications((current) => {
        const notificationId = notification.id || notification._id;

        const withoutDuplicate = current.filter(
          (item) => (item.id || item._id) !== notificationId
        );

        return [notification, ...withoutDuplicate].slice(0, 20);
      });

      setMessage(notification.message || "A new classroom update arrived");
    });

    socket.on("classroom:notification_updated", (updated) => {
      setNotifications((current) => current.map((item) =>
        (item.id || item._id) === updated.id ? { ...item, ...updated } : item
      ));
    });

    socket.on("classroom:beat_deleted", ({ projectId }) => {
      setClassroom((current) => current ? {
        ...current,
        beats: (current.beats || []).filter((beat) => getId(beat.project) !== projectId)
      } : current);
      setNotifications((current) => current.filter((item) => getId(item.project) !== projectId));
    });
    socket.on("classroom:notification_deleted", ({ id }) => {
      setNotifications((current) => current.filter((item) =>
        (item.id || item._id) !== id
      ));
    });
    socket.on("connect_error", (error) => {
      setMessage(error.message || "Could not connect to classroom notifications");
    });

    return () => {
      socket.disconnect();
    };
  }, [classroom?._id, user?.id, user?._id]);

  async function createClass(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    try {
      const data = await request("/api/classrooms", {
        method: "POST",
        body: JSON.stringify({ name: className.trim() })
      });

      setClassName("");
      await loadClassrooms();

      if (data.classroom?._id) {
        await fetchClassroom(data.classroom._id);
      } else {
        setMessage("Class created. Refresh the list to open it.");
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function joinClass(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    try {
      const data = await request("/api/classrooms/join", {
        method: "POST",
        body: JSON.stringify({ code: joinCode.trim() })
      });

      setJoinCode("");
      await loadClassrooms();

      if (data.classroom?._id) {
        await fetchClassroom(data.classroom._id);
      } else {
        setMessage("You joined the class. Refresh the list to open it.");
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function createBeat(event) {
    event.preventDefault();

    if (!classroom || !beatName.trim()) {
      setMessage("Enter a name for your beat");
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      // Create the beat as a normal project first.
      const projectData = await request("/api/projects", {
        method: "POST",
        body: JSON.stringify({
          title: beatName.trim(),
          bpm: 120,
          stepCount: 16,
          tracks: makeBlankTracks()
        })
      });

      const project = projectData.project;

      if (!project?._id) {
        throw new Error("The beat was created, but no project ID was returned");
      }

      // Add the new project to this classroom. The backend shares it
      // with members and broadcasts a classroom notification.
      await request(`/api/classrooms/${classroom._id}/beats`, {
        method: "POST",
        body: JSON.stringify({ projectId: project._id })
      });

      setBeatName("");
      await fetchClassroom(classroom._id);
      await loadClassrooms();
      setMessage("Beat added to the classroom");

      // App.jsx uses this callback to load the project in the beatbox.
      onOpenBeat?.(project._id);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteProjectPermanently(projectId) {
    if (!classroom) return;
    if (!window.confirm('Permanently delete this project from the producer account and all classrooms? This cannot be undone.')) return;

    setBusy(true);
    setMessage('');
    try {
      await request(`/api/classrooms/${classroom._id}/beats/${projectId}/delete`, { method: 'DELETE' });
      await fetchClassroom(classroom._id);
      await loadClassrooms();
      await onProjectDeleted?.();
      setMessage('Project permanently deleted');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }
  async function removeBeat(projectId) {
    if (!classroom) return;
    if (!window.confirm('Remove this beat from the classroom? The original project will stay in its creator account.')) return;

    setBusy(true);
    setMessage('');
    try {
      await request(`/api/classrooms/${classroom._id}/beats/${projectId}`, { method: 'DELETE' });
      await fetchClassroom(classroom._id);
      await loadClassrooms();
      setMessage('Beat removed from classroom');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveNotificationEdit(event, notificationId) {
    event.preventDefault();
    const text = editNotificationDraft.trim();
    if (!classroom || !text) {
      setMessage('Notification cannot be empty');
      return;
    }

    setBusy(true);
    setMessage('');
    try {
      await request(`/api/classrooms/${classroom._id}/notifications/${notificationId}`, {
        method: 'PATCH',
        body: JSON.stringify({ message: text })
      });
      setEditingNotificationId('');
      setEditNotificationDraft('');
      await fetchClassroom(classroom._id);
      setMessage('Notification updated');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteNotification(notificationId) {
    if (!classroom) return;
    if (!window.confirm('Delete this classroom notification?')) return;

    setBusy(true);
    setMessage('');
    try {
      await request(`/api/classrooms/${classroom._id}/notifications/${notificationId}`, { method: 'DELETE' });
      setNotifications((current) => current.filter((item) => getId(item) !== notificationId));
      setMessage('Notification deleted');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }
  async function postAssignment(event) {
    event.preventDefault();

    if (!classroom || !assignmentTitle.trim()) return;

    setBusy(true);
    setMessage("");

    try {
      await request(`/api/classrooms/${classroom._id}/assignments`, {
        method: "POST",
        body: JSON.stringify({
          title: assignmentTitle.trim(),
          instructions: instructions.trim()
        })
      });

      setAssignmentTitle("");
      setInstructions("");
      await fetchClassroom(classroom._id);
      setMessage("Assignment posted");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function postAnnouncement(event) {
    event.preventDefault();

    const text = announcement.trim();
    if (!classroom || !text) {
      setMessage("Write a notification first");
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      await request(`/api/classrooms/${classroom._id}/notifications`, {
        method: "POST",
        body: JSON.stringify({ message: text })
      });

      setAnnouncement("");
      await fetchClassroom(classroom._id);
      setMessage("Notification posted to the classroom");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }
  const members = classroom?.members || [];
  const beats = classroom?.beats || [];
  const assignments = classroom?.assignments || [];
  const currentUserId = getId(user);
  const ownerId = getId(classroom?.owner);

  const membership = members.find(
    (member) => getId(member.user) === currentUserId
  );

  const isTeacher =
    ownerId === currentUserId || membership?.role === "teacher";

  return (
    <section className="classroom-page">
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">LEARN AND CREATE TOGETHER</p>
          <h1>Classroom</h1>
          <p className="muted">
            Create beats together and get notified when classmates add one.
          </p>
        </div>

        <button
          className="quiet-button"
          type="button"
          onClick={loadClassrooms}
          disabled={busy}
        >
          Refresh
        </button>
      </div>

      {message && <p className="notice">{message}</p>}

      <div className="classroom-actions">
        <form className="classroom-card" onSubmit={createClass}>
          <p className="eyebrow">TEACHER</p>
          <h2>Create a classroom</h2>
          <p className="muted">Create a class and share its join code.</p>

          <input
            className="classroom-input"
            value={className}
            onChange={(event) => setClassName(event.target.value)}
            maxLength={80}
            placeholder="Example: Music Production 101"
            required
          />

          <button className="primary-button" disabled={busy}>
            Create classroom
          </button>
        </form>

        <form className="classroom-card" onSubmit={joinClass}>
          <p className="eyebrow">STUDENT</p>
          <h2>Join a classroom</h2>
          <p className="muted">Enter the code shared by your teacher.</p>

          <input
            className="classroom-input"
            value={joinCode}
            onChange={(event) => setJoinCode(event.target.value)}
            maxLength={32}
            placeholder="Class join code"
            required
          />

          <button className="primary-button" disabled={busy}>
            Join classroom
          </button>
        </form>
      </div>

      <section className="classroom-section">
        <div className="classroom-section-heading">
          <div>
            <p className="eyebrow">YOUR CLASSES</p>
            <h2>Classrooms</h2>
          </div>
          <span className="classroom-count">
            {classrooms.length} joined
          </span>
        </div>

        {classrooms.length === 0 ? (
          <p className="muted">You haven’t joined a classroom yet.</p>
        ) : (
          <div className="classroom-list">
            {classrooms.map((item) => (
              <button
                className={`classroom-list-item ${
                  classroom?._id === item._id ? "selected" : ""
                }`}
                key={item._id}
                type="button"
                onClick={() => openClassroom(item._id)}
                disabled={busy}
              >
                <span className="classroom-icon">♫</span>
                <span>
                  <strong>{item.name}</strong>
                  <small>{item.members?.length ?? 0} members</small>
                </span>
                <span className="classroom-arrow">→</span>
              </button>
            ))}
          </div>
        )}
      </section>

      {classroom && (
        <section className="classroom-detail">
          <div className="classroom-section-heading">
            <div>
              <p className="eyebrow">CLASSROOM</p>
              <h2>{classroom.name}</h2>
            </div>

            {classroom.joinCode && (
              <div className="classroom-code">
                Join code <strong>{classroom.joinCode}</strong>
              </div>
            )}
          </div>

          <section className="classroom-subsection classroom-beatbox">
            <p className="eyebrow">CLASS BEAT BOX</p>
            <h2>Create a beat for this classroom</h2>
            <p className="muted">
              Your beat will be shared with the class, and classmates will get
              a notification.
            </p>

            <form className="classroom-beat-form" onSubmit={createBeat}>
              <input
                className="classroom-input"
                value={beatName}
                onChange={(event) => setBeatName(event.target.value)}
                maxLength={100}
                placeholder="Name your beat"
                required
              />

              <button className="primary-button" disabled={busy}>
                {busy ? "Creating..." : "Create classroom beat"}
              </button>
            </form>

            <div className="classroom-beat-list">
              {beats.length === 0 ? (
                <p className="muted">No beats have been added to this class.</p>
              ) : (
                beats.map((beat, index) => {
                  const beatProject = beat.project;
                  const projectId = getId(beatProject);

                  if (!projectId) return null;

                  return (
                    <article
                      className="classroom-beat-card"
                      key={projectId || index}
                    >
                      <div>
                        <strong>{beatProject.title || "Untitled beat"}</strong>
                        <small>
                          {beatProject.bpm || 120} BPM ·{" "}
                          {beatProject.stepCount || 16} steps
                          {beat.creator?.name
                            ? ` · by ${beat.creator.name}`
                            : ""}
                        </small>
                      </div>

                      <button
                        className="quiet-button"
                        type="button"
                        onClick={() => onOpenBeat?.(projectId)}
                      >
                        Open beat
                      </button>
                      {(isTeacher || getId(beat.creator) === currentUserId) && (
                        <button
                          className="quiet-button danger-button"
                          type="button"
                          onClick={() => removeBeat(projectId)}
                          disabled={busy}
                        >
                          Remove
                        </button>
                      )}                      {getId(beat.creator) === currentUserId && (
                        <button
                          className="quiet-button danger-button"
                          type="button"
                          onClick={() => deleteProjectPermanently(projectId)}
                          disabled={busy}
                        >
                          Delete project
                        </button>
                      )}
                    </article>
                  );
                })
              )}
            </div>
          </section>

          <div className="classroom-columns">
            <section className="classroom-subsection">
              <p className="eyebrow">CLASS MEMBERS</p>

              {members.length === 0 ? (
                <p className="muted">No members are listed yet.</p>
              ) : (
                <ul className="classroom-members">
                  {members.map((member, index) => {
                    const person = member.user || {};
                    const personName = person.name || "Class member";

                    return (
                      <li key={getId(person) || index}>
                        <span className="classroom-avatar">
                          {personName.slice(0, 1).toUpperCase()}
                        </span>
                        <span>
                          <strong>{personName}</strong>
                          <small>{member.role || "student"}</small>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="classroom-subsection">
              <p className="eyebrow">ASSIGNMENTS</p>

              {assignments.length === 0 ? (
                <p className="muted">No assignments posted yet.</p>
              ) : (
                <div className="assignment-list">
                  {assignments.map((assignment, index) => (
                    <article
                      className="assignment-card"
                      key={getId(assignment) || index}
                    >
                      <h3>{assignment.title}</h3>
                      <p className="muted">
                        {assignment.instructions ||
                          "No instructions provided."}
                      </p>
                    </article>
                  ))}
                </div>
              )}

              {isTeacher && (
                <form className="assignment-form" onSubmit={postAssignment}>
                  <label>
                    Assignment title
                    <input
                      className="classroom-input"
                      value={assignmentTitle}
                      onChange={(event) =>
                        setAssignmentTitle(event.target.value)
                      }
                      maxLength={100}
                      placeholder="Create a 4-bar drum beat"
                      required
                    />
                  </label>

                  <label>
                    Instructions
                    <textarea
                      className="classroom-input"
                      value={instructions}
                      onChange={(event) => setInstructions(event.target.value)}
                      maxLength={1000}
                      rows={4}
                      placeholder="Describe what students should create..."
                    />
                  </label>

                  <button className="primary-button" disabled={busy}>
                    Post assignment
                  </button>
                </form>
              )}
            </section>
          </div>

          <section className="classroom-section classroom-notifications">
            <div className="classroom-section-heading">
              <div>
                <p className="eyebrow">LIVE UPDATES</p>
                <h2>Class notifications</h2>
              </div>
            </div>

            {isTeacher && (
              <form className="assignment-form" onSubmit={postAnnouncement}>
                <label>
                  Send a notification to the class
                  <textarea
                    className="classroom-input"
                    value={announcement}
                    onChange={(event) => setAnnouncement(event.target.value)}
                    maxLength={250}
                    rows={3}
                    placeholder="Write a class announcement..."
                    required
                  />
                </label>
                <button className="primary-button" disabled={busy}>
                  {busy ? "Sending..." : "Post notification"}
                </button>
              </form>
            )}
            {notifications.length === 0 ? (
              <p className="muted">No classroom notifications yet.</p>
            ) : (
              <ul>
                {notifications.slice(0, 10).map((notification, index) => {
                  const notificationId = getId(notification);
                  const isEditing = editingNotificationId === notificationId;

                  return (
                    <li key={notificationId || index}>
                      <span className="classroom-notification-dot" />
                      {isEditing ? (
                        <form className="notification-edit-form" onSubmit={(event) => saveNotificationEdit(event, notificationId)}>
                          <textarea
                            className="classroom-input"
                            value={editNotificationDraft}
                            onChange={(event) => setEditNotificationDraft(event.target.value)}
                            maxLength={250}
                            rows={2}
                            required
                          />
                          <button className="primary-button" disabled={busy}>Save</button>
                          <button className="quiet-button" type="button" onClick={() => { setEditingNotificationId(""); setEditNotificationDraft(""); }}>Cancel</button>
                        </form>
                      ) : (
                        <span>{notification.message}</span>
                      )}
                      <small>{notification.createdAt ? new Date(notification.createdAt).toLocaleString() : ""}</small>
                      {isTeacher && !isEditing && (
                        <span className="notification-actions">
                          {notification.type === "announcement" && (
                            <button className="quiet-button" type="button" onClick={() => { setEditingNotificationId(notificationId); setEditNotificationDraft(notification.message || ""); }}>Edit</button>
                          )}
                          <button className="quiet-button danger-button" type="button" onClick={() => deleteNotification(notificationId)} disabled={busy}>Delete</button>
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </section>
      )}
    </section>
  );
}



