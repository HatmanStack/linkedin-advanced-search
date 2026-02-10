"""
Profile Markdown Generator (Python)

Converts structured profile data from DynamoDB into well-formatted markdown
suitable for RAGStack ingestion.
"""

from typing import Any

MAX_ABOUT_LENGTH = 5000


def escape_markdown(text: str | None) -> str:
    """Escape special markdown characters in text"""
    if not text or not isinstance(text, str):
        return ''
    return text.replace('\\', '\\\\').replace('*', '\\*').replace('_', '\\_').replace('<', '&lt;').replace('>', '&gt;')


def format_date_range(start_date: str | None, end_date: str | None) -> str:
    """Format a date range string"""
    start = start_date or 'Unknown'
    end = end_date or 'Present'
    return f'{start} - {end}'


def generate_current_position_section(current_position: dict[str, Any] | None) -> str:
    """Generate markdown for current position section"""
    if not current_position:
        return ''

    lines = ['## Current Position']

    if current_position.get('title'):
        lines.append(f'- **Title:** {escape_markdown(current_position["title"])}')
    if current_position.get('company'):
        lines.append(f'- **Company:** {escape_markdown(current_position["company"])}')
    if current_position.get('employment_type'):
        lines.append(f'- **Type:** {escape_markdown(current_position["employment_type"])}')
    if current_position.get('start_date') or current_position.get('end_date'):
        lines.append(
            f'- **Duration:** {format_date_range(current_position.get("start_date"), current_position.get("end_date"))}'
        )
    if current_position.get('description'):
        lines.append('')
        lines.append(escape_markdown(current_position['description']))

    return '\n'.join(lines) if len(lines) > 1 else ''


def generate_experience_section(experience: list[dict[str, Any]] | None) -> str:
    """Generate markdown for experience section"""
    if not experience or not isinstance(experience, list) or len(experience) == 0:
        return ''

    lines = ['## Experience']

    # Sort by start_date descending
    sorted_exp = sorted(
        experience,
        key=lambda x: x.get('start_date', '0000'),
        reverse=True,
    )

    for exp in sorted_exp:
        if exp.get('company'):
            lines.append(f'### {escape_markdown(exp["company"])}')

        title_parts = []
        if exp.get('title'):
            title_parts.append(f'**{escape_markdown(exp["title"])}**')
        if exp.get('employment_type'):
            title_parts.append(escape_markdown(exp['employment_type']))
        if exp.get('start_date') or exp.get('end_date'):
            title_parts.append(f'| {format_date_range(exp.get("start_date"), exp.get("end_date"))}')

        if title_parts:
            lines.append(' '.join(title_parts))

        if exp.get('description'):
            lines.append('')
            lines.append(escape_markdown(exp['description']))

        lines.append('')

    return '\n'.join(lines).strip()


def generate_education_section(education: list[dict[str, Any]] | None) -> str:
    """Generate markdown for education section"""
    if not education or not isinstance(education, list) or len(education) == 0:
        return ''

    lines = ['## Education']

    for edu in education:
        if edu.get('school'):
            lines.append(f'### {escape_markdown(edu["school"])}')

        degree_parts = []
        if edu.get('degree'):
            degree_parts.append(escape_markdown(edu['degree']))
        if edu.get('field_of_study'):
            degree_parts.append(f'in {escape_markdown(edu["field_of_study"])}')
        if edu.get('start_date') or edu.get('end_date'):
            degree_parts.append(f'| {format_date_range(edu.get("start_date"), edu.get("end_date"))}')

        if degree_parts:
            lines.append(' '.join(degree_parts))

        if edu.get('description'):
            lines.append('')
            lines.append(escape_markdown(edu['description']))

        lines.append('')

    return '\n'.join(lines).strip()


def generate_skills_section(skills: list[str] | None) -> str:
    """Generate markdown for skills section"""
    if not skills or not isinstance(skills, list) or len(skills) == 0:
        return ''

    escaped_skills = [escape_markdown(skill) for skill in skills]
    return f'## Skills\n{", ".join(escaped_skills)}'


def generate_profile_markdown(profile: dict[str, Any]) -> str:
    """
    Generate markdown document from profile data.

    Args:
        profile: Profile data dict from DynamoDB

    Returns:
        Formatted markdown string
    """
    if not profile or not isinstance(profile, dict):
        raise ValueError('Profile must be a non-null dict')

    name = profile.get('name')
    if not name:
        raise ValueError('Profile must have a name')

    sections = []

    # Header with name
    sections.append(f'# {escape_markdown(name)}')

    # Metadata block
    metadata = []
    if profile.get('headline'):
        metadata.append(f'**Headline:** {escape_markdown(profile["headline"])}')
    if profile.get('location') or profile.get('currentLocation'):
        location = profile.get('location') or profile.get('currentLocation')
        metadata.append(f'**Location:** {escape_markdown(location)}')
    if profile.get('profile_id'):
        metadata.append(f'**Profile ID:** {profile["profile_id"]}')

    if metadata:
        sections.append('\n'.join(metadata))

    # About section
    about = profile.get('about') or profile.get('summary')
    if about:
        if len(about) > MAX_ABOUT_LENGTH:
            about = about[:MAX_ABOUT_LENGTH] + '...'
        sections.append(f'## About\n{escape_markdown(about)}')

    # Current position
    current_pos = profile.get('current_position')
    if not current_pos and profile.get('currentTitle'):
        # Build current position from DynamoDB fields
        current_pos = {
            'title': profile.get('currentTitle'),
            'company': profile.get('currentCompany'),
        }
    current_section = generate_current_position_section(current_pos)
    if current_section:
        sections.append(current_section)

    # Experience
    experience_section = generate_experience_section(profile.get('experience'))
    if experience_section:
        sections.append(experience_section)

    # Education
    education_section = generate_education_section(profile.get('education'))
    if education_section:
        sections.append(education_section)

    # Skills
    skills_section = generate_skills_section(profile.get('skills'))
    if skills_section:
        sections.append(skills_section)

    return '\n\n'.join(sections)
