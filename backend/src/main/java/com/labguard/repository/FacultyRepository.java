package com.labguard.repository;

import com.labguard.entity.Faculty;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface FacultyRepository extends JpaRepository<Faculty, UUID> {
    Optional<Faculty> findByUserId(UUID userId);
    Optional<Faculty> findByEmployeeId(String employeeId);
    Optional<Faculty> findByFacultyId(String facultyId);
}
