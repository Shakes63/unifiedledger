import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/owner-helpers", () => ({
  requireOwner: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("nanoid", () => ({
  nanoid: vi.fn(() => "id-1"),
}));

import { requireOwner } from "@/lib/auth/owner-helpers";
import { db } from "@/lib/db";

function createReq(url: string, init?: RequestInit): Request {
  return new Request(url, init);
}

async function params(userId: string): Promise<{ userId: string }> {
  return { userId };
}

describe("app/api/admin/users/[userId]/route - PUT", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthorized", async () => {
    vi.mocked(requireOwner).mockRejectedValueOnce(new Error("Unauthorized"));
    const { PUT } = await import("@/app/api/admin/users/[userId]/route");

    const res = await PUT(
      createReq("http://localhost/api/admin/users/u1", {
        method: "PUT",
        body: JSON.stringify({ name: "New" }),
      }),
      { params: params("u1") }
    );

    expect(res.status).toBe(401);
    const data = (await res.json()) as { error: string };
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 403 when not owner", async () => {
    vi.mocked(requireOwner).mockRejectedValueOnce(
      new Error("Forbidden: Owner access required")
    );
    const { PUT } = await import("@/app/api/admin/users/[userId]/route");

    const res = await PUT(
      createReq("http://localhost/api/admin/users/u1", {
        method: "PUT",
        body: JSON.stringify({ name: "New" }),
      }),
      { params: params("u1") }
    );

    expect(res.status).toBe(403);
    const data = (await res.json()) as { error: string };
    expect(data.error).toContain("Owner");
  });

  it("returns 404 when user not found", async () => {
    vi.mocked(requireOwner).mockResolvedValueOnce({ userId: "owner-1" } as never);

    // user exists check -> empty
    vi.mocked(db.select).mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: async () => [],
        }),
      }),
    } as unknown as ReturnType<typeof db.select>);

    const { PUT } = await import("@/app/api/admin/users/[userId]/route");
    const res = await PUT(
      createReq("http://localhost/api/admin/users/u1", {
        method: "PUT",
        body: JSON.stringify({ name: "New" }),
      }),
      { params: params("u1") }
    );

    expect(res.status).toBe(404);
    const data = (await res.json()) as { error: string };
    expect(data.error).toBe("User not found");
  });

  it("returns 403 when trying to modify application owner", async () => {
    vi.mocked(requireOwner).mockResolvedValueOnce({ userId: "owner-1" } as never);

    vi.mocked(db.select)
      // user exists
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: async () => [{ id: "u1", email: "a@example.com" }],
          }),
        }),
      } as unknown as ReturnType<typeof db.select>)
      // ownerCheck
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: async () => [{ isApplicationOwner: true }],
          }),
        }),
      } as unknown as ReturnType<typeof db.select>);

    const { PUT } = await import("@/app/api/admin/users/[userId]/route");
    const res = await PUT(
      createReq("http://localhost/api/admin/users/u1", {
        method: "PUT",
        body: JSON.stringify({ name: "New" }),
      }),
      { params: params("u1") }
    );

    expect(res.status).toBe(403);
    const data = (await res.json()) as { error: string };
    expect(data.error).toContain("application owner");
  });

  it("returns 400 for invalid email format", async () => {
    vi.mocked(requireOwner).mockResolvedValueOnce({ userId: "owner-1" } as never);

    vi.mocked(db.select)
      // user exists
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: async () => [{ id: "u1", email: "a@example.com" }],
          }),
        }),
      } as unknown as ReturnType<typeof db.select>)
      // ownerCheck
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: async () => [{ isApplicationOwner: false }],
          }),
        }),
      } as unknown as ReturnType<typeof db.select>);

    const { PUT } = await import("@/app/api/admin/users/[userId]/route");
    const res = await PUT(
      createReq("http://localhost/api/admin/users/u1", {
        method: "PUT",
        body: JSON.stringify({ email: "not-an-email" }),
      }),
      { params: params("u1") }
    );

    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: string };
    expect(data.error).toContain("Invalid email");
  });

  it("returns 409 when email already exists for another user", async () => {
    vi.mocked(requireOwner).mockResolvedValueOnce({ userId: "owner-1" } as never);

    vi.mocked(db.select)
      // user exists
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: async () => [{ id: "u1", email: "a@example.com" }],
          }),
        }),
      } as unknown as ReturnType<typeof db.select>)
      // ownerCheck
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: async () => [{ isApplicationOwner: false }],
          }),
        }),
      } as unknown as ReturnType<typeof db.select>)
      // email exists check -> existing other user
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: async () => [{ id: "someone-else" }],
          }),
        }),
      } as unknown as ReturnType<typeof db.select>);

    const { PUT } = await import("@/app/api/admin/users/[userId]/route");
    const res = await PUT(
      createReq("http://localhost/api/admin/users/u1", {
        method: "PUT",
        body: JSON.stringify({ email: "b@example.com" }),
      }),
      { params: params("u1") }
    );

    expect(res.status).toBe(409);
    const data = (await res.json()) as { error: string };
    expect(data.error).toContain("Email already exists");
  });

  it("returns 404 when household does not exist", async () => {
    vi.mocked(requireOwner).mockResolvedValueOnce({ userId: "owner-1" } as never);

    vi.mocked(db.select)
      // user exists
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: async () => [{ id: "u1", email: "a@example.com" }],
          }),
        }),
      } as unknown as ReturnType<typeof db.select>)
      // ownerCheck
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: async () => [{ isApplicationOwner: false }],
          }),
        }),
      } as unknown as ReturnType<typeof db.select>)
      // household exists check -> empty
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: async () => [],
          }),
        }),
      } as unknown as ReturnType<typeof db.select>);

    const { PUT } = await import("@/app/api/admin/users/[userId]/route");
    const res = await PUT(
      createReq("http://localhost/api/admin/users/u1", {
        method: "PUT",
        body: JSON.stringify({ householdId: "h-missing", role: "member" }),
      }),
      { params: params("u1") }
    );

    expect(res.status).toBe(404);
    const data = (await res.json()) as { error: string };
    expect(data.error).toBe("Household not found");
  });

  it("returns 400 for invalid role when household provided", async () => {
    vi.mocked(requireOwner).mockResolvedValueOnce({ userId: "owner-1" } as never);

    vi.mocked(db.select)
      // user exists
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: async () => [{ id: "u1", email: "a@example.com" }],
          }),
        }),
      } as unknown as ReturnType<typeof db.select>)
      // ownerCheck
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: async () => [{ isApplicationOwner: false }],
          }),
        }),
      } as unknown as ReturnType<typeof db.select>)
      // household exists check -> found
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: async () => [{ id: "h1" }],
          }),
        }),
      } as unknown as ReturnType<typeof db.select>);

    const { PUT } = await import("@/app/api/admin/users/[userId]/route");
    const res = await PUT(
      createReq("http://localhost/api/admin/users/u1", {
        method: "PUT",
        body: JSON.stringify({ householdId: "h1", role: "nope" }),
      }),
      { params: params("u1") }
    );

    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: string };
    expect(data.error).toContain("Invalid role");
  });

  it("returns 200 on success and updates membership role when user already member", async () => {
    vi.mocked(requireOwner).mockResolvedValueOnce({ userId: "owner-1" } as never);

    vi.mocked(db.select)
      // user exists
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: async () => [{ id: "u1", email: "a@example.com" }],
          }),
        }),
      } as unknown as ReturnType<typeof db.select>)
      // ownerCheck
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: async () => [{ isApplicationOwner: false }],
          }),
        }),
      } as unknown as ReturnType<typeof db.select>)
      // household exists
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: async () => [{ id: "h1" }],
          }),
        }),
      } as unknown as ReturnType<typeof db.select>)
      // existingMember -> present
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: async () => [{ id: "hm1", role: "member" }],
          }),
        }),
      } as unknown as ReturnType<typeof db.select>)
      // fetch updated user
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: async () => [
              { id: "u1", email: "a@example.com", name: "New Name", createdAt: "2025-01-01" },
            ],
          }),
        }),
      } as unknown as ReturnType<typeof db.select>);

    vi.mocked(db.update)
      // update name (optional path if provided)
      .mockReturnValueOnce({
        set: () => ({
          where: async () => undefined,
        }),
      } as unknown as ReturnType<typeof db.update>)
      // update membership role
      .mockReturnValueOnce({
        set: () => ({
          where: async () => undefined,
        }),
      } as unknown as ReturnType<typeof db.update>);

    const { PUT } = await import("@/app/api/admin/users/[userId]/route");
    const res = await PUT(
      createReq("http://localhost/api/admin/users/u1", {
        method: "PUT",
        body: JSON.stringify({ name: "New Name", householdId: "h1", role: "admin" }),
      }),
      { params: params("u1") }
    );

    expect(res.status).toBe(200);
    const data = (await res.json()) as { id: string; message: string };
    expect(data.id).toBe("u1");
    expect(data.message).toContain("updated");
    expect(db.update).toHaveBeenCalled();
  });
});

describe("app/api/admin/users/[userId]/route - DELETE", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when unauthorized", async () => {
    vi.mocked(requireOwner).mockRejectedValueOnce(new Error("Unauthorized"));
    const { DELETE } = await import("@/app/api/admin/users/[userId]/route");

    const res = await DELETE(createReq("http://localhost/api/admin/users/u1", { method: "DELETE" }), {
      params: params("u1"),
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 when user not found", async () => {
    vi.mocked(requireOwner).mockResolvedValueOnce({ userId: "owner-1" } as never);

    vi.mocked(db.select).mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: async () => [],
        }),
      }),
    } as unknown as ReturnType<typeof db.select>);

    const { DELETE } = await import("@/app/api/admin/users/[userId]/route");
    const res = await DELETE(createReq("http://localhost/api/admin/users/u1", { method: "DELETE" }), {
      params: params("u1"),
    });
    expect(res.status).toBe(404);
    const data = (await res.json()) as { error: string };
    expect(data.error).toBe("User not found");
  });

  it("returns 403 when trying to delete application owner", async () => {
    vi.mocked(requireOwner).mockResolvedValueOnce({ userId: "owner-1" } as never);

    vi.mocked(db.select).mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: async () => [{ id: "u1", isApplicationOwner: true }],
        }),
      }),
    } as unknown as ReturnType<typeof db.select>);

    const { DELETE } = await import("@/app/api/admin/users/[userId]/route");
    const res = await DELETE(createReq("http://localhost/api/admin/users/u1", { method: "DELETE" }), {
      params: params("u1"),
    });
    expect(res.status).toBe(403);
  });

  it("returns 200 on success and deletes memberships then user", async () => {
    vi.mocked(requireOwner).mockResolvedValueOnce({ userId: "owner-1" } as never);

    vi.mocked(db.select).mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: async () => [{ id: "u1", isApplicationOwner: false }],
        }),
      }),
    } as unknown as ReturnType<typeof db.select>);

    vi.mocked(db.delete)
      // delete householdMembers
      .mockReturnValueOnce({
        where: async () => undefined,
      } as unknown as ReturnType<typeof db.delete>)
      // delete user
      .mockReturnValueOnce({
        where: async () => undefined,
      } as unknown as ReturnType<typeof db.delete>);

    const { DELETE } = await import("@/app/api/admin/users/[userId]/route");
    const res = await DELETE(createReq("http://localhost/api/admin/users/u1", { method: "DELETE" }), {
      params: params("u1"),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as { message: string };
    expect(data.message).toContain("deleted");
    expect(db.delete).toHaveBeenCalledTimes(2);
  });
});


