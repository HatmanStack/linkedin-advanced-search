"""Unit tests for ConversionLikelihood enum and classification function."""
from datetime import UTC, datetime, timedelta

import pytest

from models.enums import ConversionLikelihood, classify_conversion_likelihood


class TestConversionLikelihood:
    """Tests for ConversionLikelihood enum values."""

    def test_enum_values_exist(self):
        """Enum should have HIGH, MEDIUM, LOW values."""
        assert ConversionLikelihood.HIGH.value == 'high'
        assert ConversionLikelihood.MEDIUM.value == 'medium'
        assert ConversionLikelihood.LOW.value == 'low'

    def test_enum_is_string_enum(self):
        """Enum values should be usable as strings."""
        assert ConversionLikelihood.HIGH == 'high'
        assert ConversionLikelihood.MEDIUM == 'medium'
        assert ConversionLikelihood.LOW == 'low'

    def test_enum_serialization(self):
        """Enum should serialize to string for JSON."""
        import json

        data = {'likelihood': ConversionLikelihood.HIGH.value}
        serialized = json.dumps(data)
        assert serialized == '{"likelihood": "high"}'


class TestClassifyConversionLikelihood:
    """Tests for classify_conversion_likelihood function."""

    def test_high_complete_profile_recent_no_attempts(self):
        """HIGH: Complete profile + recent (< 7 days) + no attempts."""
        profile = {
            'headline': 'Software Engineer at Tech Corp',
            'summary': 'Experienced developer with 10 years of experience.',
        }
        edge = {
            'date_added': (datetime.now(UTC) - timedelta(days=3)).isoformat(),
            'connection_attempts': 0,
        }

        result = classify_conversion_likelihood(profile, edge)
        assert result == ConversionLikelihood.HIGH

    def test_low_missing_headline(self):
        """LOW: Missing headline."""
        profile = {
            'summary': 'Some summary',
        }
        edge = {
            'date_added': datetime.now(UTC).isoformat(),
            'connection_attempts': 0,
        }

        result = classify_conversion_likelihood(profile, edge)
        assert result == ConversionLikelihood.LOW

    def test_low_missing_summary(self):
        """LOW: Missing summary."""
        profile = {
            'headline': 'Software Engineer',
        }
        edge = {
            'date_added': datetime.now(UTC).isoformat(),
            'connection_attempts': 0,
        }

        result = classify_conversion_likelihood(profile, edge)
        assert result == ConversionLikelihood.LOW

    def test_low_too_many_attempts(self):
        """LOW: More than 2 attempts."""
        profile = {
            'headline': 'Software Engineer',
            'summary': 'Experienced developer',
        }
        edge = {
            'date_added': datetime.now(UTC).isoformat(),
            'connection_attempts': 3,
        }

        result = classify_conversion_likelihood(profile, edge)
        assert result == ConversionLikelihood.LOW

    def test_medium_complete_but_old(self):
        """MEDIUM: Complete profile but added > 7 days ago."""
        profile = {
            'headline': 'Software Engineer',
            'summary': 'Experienced developer',
        }
        edge = {
            'date_added': (datetime.now(UTC) - timedelta(days=10)).isoformat(),
            'connection_attempts': 0,
        }

        result = classify_conversion_likelihood(profile, edge)
        assert result == ConversionLikelihood.MEDIUM

    def test_medium_complete_but_some_attempts(self):
        """MEDIUM: Complete profile but has 1-2 attempts."""
        profile = {
            'headline': 'Software Engineer',
            'summary': 'Experienced developer',
        }
        edge = {
            'date_added': datetime.now(UTC).isoformat(),
            'connection_attempts': 2,
        }

        result = classify_conversion_likelihood(profile, edge)
        assert result == ConversionLikelihood.MEDIUM

    def test_handles_missing_edge_data(self):
        """Should handle missing edge data gracefully."""
        profile = {
            'headline': 'Software Engineer',
            'summary': 'Experienced developer',
        }
        edge = {}

        result = classify_conversion_likelihood(profile, edge)
        assert result == ConversionLikelihood.MEDIUM

    def test_handles_none_profile(self):
        """Should handle None profile gracefully."""
        edge = {
            'date_added': datetime.now(UTC).isoformat(),
            'connection_attempts': 0,
        }

        result = classify_conversion_likelihood(None, edge)
        assert result == ConversionLikelihood.LOW

    def test_handles_none_edge(self):
        """Should handle None edge gracefully."""
        profile = {
            'headline': 'Software Engineer',
            'summary': 'Experienced developer',
        }

        result = classify_conversion_likelihood(profile, None)
        assert result == ConversionLikelihood.MEDIUM

    def test_handles_empty_headline(self):
        """Empty string headline should be treated as missing."""
        profile = {
            'headline': '',
            'summary': 'Experienced developer',
        }
        edge = {
            'date_added': datetime.now(UTC).isoformat(),
            'connection_attempts': 0,
        }

        result = classify_conversion_likelihood(profile, edge)
        assert result == ConversionLikelihood.LOW

    def test_handles_whitespace_only_summary(self):
        """Whitespace-only summary should be treated as missing."""
        profile = {
            'headline': 'Software Engineer',
            'summary': '   ',
        }
        edge = {
            'date_added': datetime.now(UTC).isoformat(),
            'connection_attempts': 0,
        }

        result = classify_conversion_likelihood(profile, edge)
        assert result == ConversionLikelihood.LOW

    def test_boundary_exactly_7_days(self):
        """Exactly 7 days should be considered old (>= 7 days boundary)."""
        profile = {
            'headline': 'Software Engineer',
            'summary': 'Experienced developer',
        }
        edge = {
            'date_added': (datetime.now(UTC) - timedelta(days=7)).isoformat(),
            'connection_attempts': 0,
        }

        result = classify_conversion_likelihood(profile, edge)
        assert result == ConversionLikelihood.MEDIUM

    def test_boundary_exactly_3_attempts(self):
        """Exactly 3 attempts should be LOW (> 2 threshold)."""
        profile = {
            'headline': 'Software Engineer',
            'summary': 'Experienced developer',
        }
        edge = {
            'date_added': datetime.now(UTC).isoformat(),
            'connection_attempts': 3,
        }

        result = classify_conversion_likelihood(profile, edge)
        assert result == ConversionLikelihood.LOW
