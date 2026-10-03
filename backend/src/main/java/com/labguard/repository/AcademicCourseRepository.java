package com.labguard.repository;

import com.labguard.entity.AcademicCourse;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface AcademicCourseRepository extends JpaRepository<AcademicCourse, UUID> {
    Optional<AcademicCourse> findByCode(String code);
    List<AcademicCourse> findByDepartmentId(UUID departmentId);
}
