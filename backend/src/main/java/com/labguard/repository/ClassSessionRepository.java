package com.labguard.repository;

import com.labguard.entity.ClassSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ClassSessionRepository extends JpaRepository<ClassSession, UUID> {
    List<ClassSession> findByFacultyId(UUID facultyId);
    List<ClassSession> findByLabId(UUID labId);
    List<ClassSession> findByStatus(String status);
}
