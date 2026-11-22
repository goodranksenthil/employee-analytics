from datetime import date, datetime
from typing import List, Optional

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class User(Base):
    """Login account. role is one of: employee, delivery_manager, finance, hr."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(80), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(120))
    role: Mapped[str] = mapped_column(String(30))
    # For the employee role: which employee record this login belongs to.
    employee_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("employees.id", ondelete="SET NULL"), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Skill(Base):
    __tablename__ = "skills"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80), unique=True)
    category: Mapped[str] = mapped_column(String(50))
    # Extra $/hour added to a bill rate for an in-demand skill (scaled by proficiency).
    premium_rate: Mapped[float] = mapped_column(Float, default=0)


class RoleRate(Base):
    """Rate card: hourly bill rate per role = base + per_year * experience (+ skill premiums)."""

    __tablename__ = "role_rates"

    id: Mapped[int] = mapped_column(primary_key=True)
    role: Mapped[str] = mapped_column(String(80), unique=True)
    base_rate: Mapped[float] = mapped_column(Float)
    per_year_rate: Mapped[float] = mapped_column(Float)
    max_rate: Mapped[Optional[float]] = mapped_column(Float, nullable=True)


class Employee(Base):
    __tablename__ = "employees"

    id: Mapped[int] = mapped_column(primary_key=True)
    emp_code: Mapped[str] = mapped_column(String(20), unique=True)
    full_name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(160), unique=True)
    role: Mapped[str] = mapped_column(String(80))
    years_experience: Mapped[float] = mapped_column(Float)
    location: Mapped[str] = mapped_column(String(80))
    join_date: Mapped[date] = mapped_column(Date)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    skills: Mapped[List["EmployeeSkill"]] = relationship(
        back_populates="employee", cascade="all, delete-orphan"
    )
    allocations: Mapped[List["Allocation"]] = relationship(
        back_populates="employee", cascade="all, delete-orphan"
    )


class EmployeeSkill(Base):
    __tablename__ = "employee_skills"
    __table_args__ = (UniqueConstraint("employee_id", "skill_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id", ondelete="CASCADE"))
    skill_id: Mapped[int] = mapped_column(ForeignKey("skills.id", ondelete="CASCADE"))
    proficiency: Mapped[int] = mapped_column(Integer)  # 1..5
    years: Mapped[float] = mapped_column(Float, default=0)

    employee: Mapped[Employee] = relationship(back_populates="skills")
    skill: Mapped[Skill] = relationship()


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(20), unique=True)
    name: Mapped[str] = mapped_column(String(160))
    client: Mapped[str] = mapped_column(String(120))
    is_billable: Mapped[bool] = mapped_column(Boolean, default=True)
    status: Mapped[str] = mapped_column(String(20))  # Active | Pipeline | On Hold | Completed
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    description: Mapped[str] = mapped_column(Text, default="")
    # Pipeline (upcoming) deals: chance of winning (%) and expected engagement length.
    probability: Mapped[int] = mapped_column(Integer, default=100)
    duration_months: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    requirements: Mapped[List["ProjectRequirement"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    allocations: Mapped[List["Allocation"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )


class ProjectRequirement(Base):
    __tablename__ = "project_requirements"

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    skill_id: Mapped[int] = mapped_column(ForeignKey("skills.id"))
    role: Mapped[str] = mapped_column(String(80))
    headcount: Mapped[int] = mapped_column(Integer, default=1)
    min_proficiency: Mapped[int] = mapped_column(Integer, default=3)
    min_experience: Mapped[float] = mapped_column(Float, default=0)

    project: Mapped[Project] = relationship(back_populates="requirements")
    skill: Mapped[Skill] = relationship()


class Application(Base):
    """An employee applying for an open position (a project requirement)."""

    __tablename__ = "applications"
    __table_args__ = (UniqueConstraint("employee_id", "requirement_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id", ondelete="CASCADE"))
    requirement_id: Mapped[int] = mapped_column(ForeignKey("project_requirements.id", ondelete="CASCADE"))
    note: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default="Applied")  # Applied | Shortlisted | Selected | Rejected
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    reviewed_by: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)

    employee: Mapped[Employee] = relationship()
    requirement: Mapped[ProjectRequirement] = relationship()


class Allocation(Base):
    __tablename__ = "allocations"

    id: Mapped[int] = mapped_column(primary_key=True)
    employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id", ondelete="CASCADE"))
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    allocation_pct: Mapped[int] = mapped_column(Integer, default=100)
    bill_rate: Mapped[float] = mapped_column(Float, default=0)  # USD per hour
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    employee: Mapped[Employee] = relationship(back_populates="allocations")
    project: Mapped[Project] = relationship(back_populates="allocations")
