"""Integration tests for tracker interview-question records."""

from typing import Any

from httpx import ASGITransport, AsyncClient

from app.database import Database
from app.main import app


def _client() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


async def _seed_card(
    isolated_db: Database,
    *,
    job_id: str,
    resume_id: str,
    company: str | None,
    role: str | None,
) -> dict[str, Any]:
    return await isolated_db.create_application(
        job_id=job_id,
        resume_id=resume_id,
        company=company,
        role=role,
    )


class TestInterviewQuestions:
    async def test_create_then_return_in_application_detail(
        self, isolated_db: Database
    ) -> None:
        card = await _seed_card(
            isolated_db,
            job_id="job-1",
            resume_id="resume-1",
            company="Acme",
            role="Engineer",
        )
        async with _client() as client:
            created = await client.post(
                f"/api/v1/applications/{card['application_id']}/interview-questions",
                json={"question": "  Tell me about a production incident.  "},
            )
            detail = await client.get(f"/api/v1/applications/{card['application_id']}")

        assert created.status_code == 200
        assert created.json()["question"] == "Tell me about a production incident."
        assert detail.status_code == 200
        questions = detail.json()["interview_questions"]
        assert len(questions) == 1
        assert questions[0]["question"] == "Tell me about a production incident."
        assert questions[0]["company"] == "Acme"
        assert questions[0]["role"] == "Engineer"

    async def test_global_list_joins_current_company_and_role(
        self, isolated_db: Database
    ) -> None:
        first = await _seed_card(
            isolated_db,
            job_id="job-1",
            resume_id="resume-1",
            company="Old Co",
            role="Backend Engineer",
        )
        second = await _seed_card(
            isolated_db,
            job_id="job-2",
            resume_id="resume-2",
            company="Beta",
            role="Platform Engineer",
        )
        async with _client() as client:
            await client.post(
                f"/api/v1/applications/{first['application_id']}/interview-questions",
                json={"question": "How do you design APIs?"},
            )
            await client.post(
                f"/api/v1/applications/{second['application_id']}/interview-questions",
                json={"question": "How do you handle on-call?"},
            )
        await isolated_db.update_application(
            first["application_id"], {"company": "Acme", "role": "Staff Engineer"}
        )

        async with _client() as client:
            response = await client.get("/api/v1/applications/interview-questions")

        assert response.status_code == 200
        questions = response.json()["questions"]
        assert len(questions) == 2
        by_company = {item["company"]: item for item in questions}
        assert by_company["Acme"]["role"] == "Staff Engineer"
        assert by_company["Beta"]["question"] == "How do you handle on-call?"

    async def test_blank_question_and_missing_application_are_rejected(
        self, isolated_db: Database
    ) -> None:
        card = await _seed_card(
            isolated_db,
            job_id="job-1",
            resume_id="resume-1",
            company="Acme",
            role="Engineer",
        )
        async with _client() as client:
            blank = await client.post(
                f"/api/v1/applications/{card['application_id']}/interview-questions",
                json={"question": "   "},
            )
            missing = await client.post(
                "/api/v1/applications/missing/interview-questions",
                json={"question": "Why this role?"},
            )

        assert blank.status_code == 422
        assert missing.status_code == 404

    async def test_application_deletion_cascades_questions(
        self, isolated_db: Database
    ) -> None:
        first = await _seed_card(
            isolated_db,
            job_id="job-1",
            resume_id="resume-1",
            company="Acme",
            role="Engineer",
        )
        second = await _seed_card(
            isolated_db,
            job_id="job-2",
            resume_id="resume-2",
            company="Beta",
            role="Designer",
        )
        async with _client() as client:
            await client.post(
                f"/api/v1/applications/{first['application_id']}/interview-questions",
                json={"question": "First question"},
            )
            await client.post(
                f"/api/v1/applications/{second['application_id']}/interview-questions",
                json={"question": "Second question"},
            )
            deleted = await client.delete(
                f"/api/v1/applications/{first['application_id']}"
            )

        assert deleted.status_code == 200
        remaining = await isolated_db.list_interview_questions()
        assert [item["question"] for item in remaining] == ["Second question"]

        assert (
            await isolated_db.bulk_delete_applications([second["application_id"]]) == 1
        )
        assert await isolated_db.list_interview_questions() == []

    async def test_reset_database_clears_questions(self, isolated_db: Database) -> None:
        card = await _seed_card(
            isolated_db,
            job_id="job-1",
            resume_id="resume-1",
            company="Acme",
            role="Engineer",
        )
        await isolated_db.create_interview_question(
            card["application_id"], "Why this role?"
        )

        await isolated_db.reset_database()

        assert await isolated_db.list_interview_questions() == []
