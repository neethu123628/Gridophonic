import { useEffect, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5002";

async function adminRequest(path, options = {}) {
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
    throw new Error(data.message || "Request failed");
  }

  return data;
}

export default function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");

  async function loadAdminData() {
    setLoading(true);
    setMessage("");

    try {
      const [usersData, projectsData] = await Promise.all([
        adminRequest("/api/admin/users"),
        adminRequest("/api/admin/projects")
      ]);

      setUsers(usersData.users || []);
      setProjects(projectsData.projects || []);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAdminData();
  }, []);

  async function changeUserStatus(user) {
    const status = user.status === "active" ? "suspended" : "active";
    const action = status === "active" ? "reactivate" : "suspend";

    if (!window.confirm(`Are you sure you want to ${action} ${user.name}?`)) {
      return;
    }

    setBusyId(user._id);
    setMessage("");

    try {
      await adminRequest(`/api/admin/users/${user._id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });

      setUsers((current) =>
        current.map((item) =>
          item._id === user._id ? { ...item, status } : item
        )
      );
      setMessage(`${user.name}'s account is now ${status}.`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusyId("");
    }
  }

  async function deleteProject(project) {
    if (!window.confirm(`Permanently delete "${project.title}"?`)) {
      return;
    }

    setBusyId(project._id);
    setMessage("");

    try {
      await adminRequest(`/api/admin/projects/${project._id}`, {
        method: "DELETE"
      });

      setProjects((current) =>
        current.filter((item) => item._id !== project._id)
      );
      setMessage(`Project "${project.title}" was deleted.`);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusyId("");
    }
  }

  const visibleUsers = users.filter((user) => {
    const query = search.trim().toLowerCase();
    return (
      !query ||
      user.name?.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query)
    );
  });

  return (
    <section className="admin-page">
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">ADMINISTRATION</p>
          <h1>Admin dashboard</h1>
          <p className="muted">Manage producer accounts and projects.</p>
        </div>

        <button
          className="quiet-button"
          type="button"
          onClick={loadAdminData}
          disabled={loading}
        >
          Refresh
        </button>
      </div>

      {message && <p className="notice">{message}</p>}

      {loading ? (
        <p className="muted admin-loading">Loading admin data...</p>
      ) : (
        <>
          <div className="admin-summary">
            <div className="admin-stat">
              <span className="eyebrow">USERS</span>
              <strong>{users.length}</strong>
            </div>
            <div className="admin-stat">
              <span className="eyebrow">PROJECTS</span>
              <strong>{projects.length}</strong>
            </div>
          </div>

          <section className="admin-section">
            <div className="admin-section-heading">
              <div>
                <p className="eyebrow">ACCOUNTS</p>
                <h2>Users</h2>
              </div>
              <input
                className="admin-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name or email"
                aria-label="Search users"
              />
            </div>

            {visibleUsers.length === 0 ? (
              <p className="muted">No matching users.</p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleUsers.map((user) => (
                      <tr key={user._id}>
                        <td>{user.name}</td>
                        <td>{user.email}</td>
                        <td>{user.role}</td>
                        <td>
                          <span className={`status-badge ${user.status}`}>
                            {user.status}
                          </span>
                        </td>
                        <td>
                          {user.role === "admin" ? (
                            <span className="muted">Admin account</span>
                          ) : (
                            <button
                              className="admin-action-button"
                              type="button"
                              disabled={busyId === user._id}
                              onClick={() => changeUserStatus(user)}
                            >
                              {busyId === user._id
                                ? "Please wait..."
                                : user.status === "active"
                                  ? "Suspend"
                                  : "Reactivate"}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="admin-section">
            <div className="admin-section-heading">
              <div>
                <p className="eyebrow">STUDIO CONTENT</p>
                <h2>Projects</h2>
              </div>
            </div>

            {projects.length === 0 ? (
              <p className="muted">No projects found.</p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Owner</th>
                      <th>Tempo</th>
                      <th>Updated</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projects.map((project) => (
                      <tr key={project._id}>
                        <td>{project.title}</td>
                        <td>
                          {project.owner?.name || "Unknown"}
                          <span className="admin-owner-email">
                            {project.owner?.email || ""}
                          </span>
                        </td>
                        <td>{project.bpm} BPM</td>
                        <td>
                          {project.updatedAt
                            ? new Date(project.updatedAt).toLocaleDateString()
                            : "—"}
                        </td>
                        <td>
                          <button
                            className="admin-action-button danger"
                            type="button"
                            disabled={busyId === project._id}
                            onClick={() => deleteProject(project)}
                          >
                            {busyId === project._id
                              ? "Please wait..."
                              : "Delete"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </section>
  );
}