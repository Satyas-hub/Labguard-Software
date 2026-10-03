package com.labguard.repository;

import com.labguard.entity.AcademicDepartment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface AcademicDepartmentRepository extends JpaRepository<AcademicDepartment, UUID> {
    Optional<AcademicDepartment> findByCode(String code);
}
